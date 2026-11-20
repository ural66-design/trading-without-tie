"""One-time preparation: Pyphen ru_RU soft hyphens in the two Russian guides."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path

import pyphen


ROOT = Path(__file__).resolve().parents[1]
DICTIONARY = pyphen.Pyphen(lang="ru_RU", left=2, right=2)
SOFT = r"(?:&shy;|&#173;|&#x[aA][dD];|\u00ad)"
WORD = re.compile(r"(?<![\w-])[А-Яа-яЁё]+(?:" + SOFT + r"[А-Яа-яЁё]+)*(?![\w-])")
VALUE = re.compile(r"\d+(?:[.,]\d+)?(?:\s|&nbsp;|&#160;|&#x[aA]0;)+[А-Яа-яЁё]+")
EXCLUDED = {"h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "a", "button",
            "summary", "label", "select", "option", "textarea", "script", "style", "code"}
PROTECTED = {"protected-name", "keep-words", "button", "back", "text-button"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
        "param", "source", "track", "wbr"}


class Guide(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source, self.stack, self.edits = source, [], []
        self.lines = [0]
        self.lines.extend(m.end() for m in re.finditer("\n", source))
        self.start = self.end = None
        self.words = self.points = 0

    def eligible(self):
        return (any(tag == "main" or attrs.get("data-panel") == "leader" for tag, attrs in self.stack)
                and any(tag in {"p", "li"} for tag, _ in self.stack)
                and not any(tag in EXCLUDED or attrs.get("role") == "status"
                            or PROTECTED.intersection(attrs.get("class", "").split())
                            for tag, attrs in self.stack))

    def flush(self):
        if self.start is not None:
            raw = self.source[self.start:self.end]
            values = [m.span() for m in VALUE.finditer(raw)]

            def hyphenate(match):
                if any(a <= match.start() < b for a, b in values):
                    return match[0]
                word = re.sub(SOFT, "", match[0])
                if len(word) < 6:
                    return match[0]
                positions, previous = [], 0
                for position in DICTIONARY.positions(word):
                    if position - previous >= 2 and len(word) - position >= 2:
                        positions.append(position)
                        previous = position
                if not positions:
                    return match[0]
                self.words += 1
                self.points += len(positions)
                bounds = [0, *positions, len(word)]
                return "&shy;".join(word[a:b] for a, b in zip(bounds, bounds[1:]))

            result = WORD.sub(hyphenate, raw)
            if result != raw:
                self.edits.append((self.start, self.end, result))
        self.start = self.end = None

    def handle_starttag(self, tag, attrs):
        self.flush()
        if tag not in VOID:
            self.stack.append((tag, dict(attrs)))

    def handle_startendtag(self, tag, attrs):
        self.flush()

    def handle_comment(self, data):
        self.flush()

    def handle_endtag(self, tag):
        self.flush()
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def text(self, length):
        if self.eligible():
            line, column = self.getpos()
            offset = self.lines[line - 1] + column
            if self.start is None:
                self.start = offset
            self.end = offset + length

    def handle_data(self, data):
        self.text(len(data))

    def handle_entityref(self, name):
        self.text(len(name) + 2)

    def handle_charref(self, name):
        self.text(len(name) + 3)


if __name__ == "__main__":
    for project in ("t-capital", "fast-money-bot"):
        path = ROOT / "site" / "ru" / project / "instruction" / "index.html"
        source = path.read_bytes().decode("utf-8")
        parser = Guide(source)
        parser.feed(source)
        parser.close()
        parser.flush()
        result = source
        for start, end, text in reversed(parser.edits):
            result = result[:start] + text + result[end:]
        assert result.replace("&shy;", "") == source.replace("&shy;", "")
        path.write_bytes(result.encode("utf-8"))
        print(json.dumps({"project": project, "words": parser.words, "points": parser.points,
                          "changed_nodes": len(parser.edits)}))

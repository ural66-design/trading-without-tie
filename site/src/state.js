export function normalise(raw,total=3) {
  const count=Number.isInteger(raw?.count) ? Math.max(0,Math.min(total,raw.count)) : 0;
  const open=raw?.open===null ? null : (Number.isInteger(raw?.open)&&raw.open>=0&&raw.open<=Math.min(count,total-1)?raw.open:count<total?count:null);
  return {visited:raw?.visited===true,count,open};
}
export function checkStep(state,index,checked,total=3) {
  if(index<0||index>=total||index>state.count) return state;
  if(checked) return index===state.count ? {...state,visited:true,count:index+1,open:index<total-1?index+1:null} : state;
  return {...state,visited:true,count:index,open:index};
}
export function toggleStep(state,index,total=3) {
  return index>state.count||index<0||index>=total ? state : {...state,open:state.open===index?null:index};
}
export const progressSticky=(state,total=3)=>state.count>0&&state.count<total;

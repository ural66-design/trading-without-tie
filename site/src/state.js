export function normalise(raw) {
  const count=Number.isInteger(raw?.count) ? Math.max(0,Math.min(3,raw.count)) : 0;
  const open=raw?.open===null ? null : (Number.isInteger(raw?.open)&&raw.open>=0&&raw.open<=Math.min(count,2)?raw.open:count<3?count:null);
  return {visited:raw?.visited===true,count,open};
}
export function checkStep(state,index,checked) {
  if(index<0||index>2||index>state.count) return state;
  if(checked) return index===state.count ? {...state,visited:true,count:index+1,open:index<2?index+1:null} : state;
  return {...state,visited:true,count:index,open:index};
}
export function toggleStep(state,index) {
  return index>state.count||index<0||index>2 ? state : {...state,open:state.open===index?null:index};
}
export const progressSticky=state=>state.count>0&&state.count<3;

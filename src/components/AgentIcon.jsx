const ICONS = {
  director: { viewBox: "0 0 24 24", elements: [
    {tag:"path",d:"M4 3h2l1.5 7h9L18 3h2v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V3z"},
    {tag:"path",d:"M6 15h12a4 4 0 0 1 4 4v2H2v-2a4 4 0 0 1 4-4z"},
    {tag:"line",x1:"8",y1:"21",x2:"16",y2:"21"},{tag:"line",x1:"12",y1:"15",x2:"12",y2:"21"},
    {tag:"circle",cx:"6.5",cy:"6.5",r:".6"},{tag:"circle",cx:"6.5",cy:"18",r:".6"},
  ]},
  doctor: { viewBox: "0 0 24 24", elements: [
    {tag:"path",d:"M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"},
    {tag:"polyline",points:"14 2 14 8 20 8"},
    {tag:"path",d:"M9 13h6"},{tag:"path",d:"M9 17h4"},
    {tag:"circle",cx:"9",cy:"9",r:"1"},
  ]},
  designer: { viewBox: "0 0 24 24", elements: [
    {tag:"circle",cx:"12",cy:"12",r:"10"},
    {tag:"path",d:"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"},
    {tag:"path",d:"M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10"},
    {tag:"line",x1:"2",y1:"12",x2:"22",y2:"12"},
    {tag:"circle",cx:"12",cy:"12",r:"2"},
  ]},
  post: { viewBox: "0 0 24 24", elements: [
    {tag:"rect",x:"3",y:"3",width:"8",height:"7",rx:"1.5"},
    {tag:"rect",x:"13",y:"3",width:"8",height:"3.5",rx:"1"},
    {tag:"rect",x:"13",y:"8.5",width:"8",height:"12.5",rx:"1"},
    {tag:"rect",x:"3",y:"12",width:"8",height:"9",rx:"1.5"},
    {tag:"circle",cx:"7",cy:"6.5",r:"1"},{tag:"circle",cx:"17",cy:"5",r:".8"},
  ]},
  seedance: { viewBox: "0 0 24 24", elements: [
    {tag:"path",d:"M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"},
    {tag:"path",d:"M8 9.5c.5-.3 1.2-.5 2-.5s1.5.2 2 .5"},
    {tag:"path",d:"M8 14.5c.5.3 1.2.5 2 .5s1.5-.2 2-.5"},
    {tag:"circle",cx:"9",cy:"10",r:".7"},{tag:"circle",cx:"15",cy:"10",r:".7"},
    {tag:"line",x1:"12",y1:"10",x2:"12",y2:"14.5"},
  ]},
  character: { viewBox: "0 0 24 24", elements: [
    {tag:"circle",cx:"12",cy:"8",r:"4"},
    {tag:"path",d:"M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"},
    {tag:"rect",x:"9",y:"1",width:"6",height:"3",rx:"1"},
    {tag:"circle",cx:"12",cy:"2.5",r:".4"},
    {tag:"rect",x:"7",y:"14.5",width:"10",height:"7",rx:"1.5"},
  ]},
  scene: { viewBox: "0 0 24 24", elements: [
    {tag:"path",d:"M2 20h20V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14z"},
    {tag:"path",d:"M2 20l5-6 4 5 4-4 7 5"},
    {tag:"circle",cx:"17",cy:"7",r:"1"},
    {tag:"line",x1:"17",y1:"6",x2:"17",y2:"8"},
  ]}
};

function renderElements(els, fillColor) {
  return els.map((el,i)=>{
    const p={};for(const[k,v]of Object.entries(el)){if(k==="tag")continue;p[k]=v}
    const Tag=el.tag;
    return <Tag key={i} {...p} fill={Tag==="rect"||Tag==="circle"?fillColor:"none"}/>;
  });
}

export default function AgentIcon({id,active}) {
  const icon=ICONS[id];if(!icon)return null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={icon.viewBox} width="20" height="20"
      stroke={active?"#fff":"currentColor"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{overflow:"visible",transition:"all .2s ease",transform:active?"scale(1.05)":"scale(1)"}}>
      {renderElements(icon.elements,active?"rgba(255,255,255,0.25)":"currentColor")}
    </svg>
  );
}

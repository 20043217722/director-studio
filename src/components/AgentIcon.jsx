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
  ]},
  lens: { viewBox: "0 0 24 24", elements: [
    // 放大镜外框
    {tag:"circle",cx:"10",cy:"10",r:"7.5"},
    // 镜片内圈 (光圈)
    {tag:"circle",cx:"10",cy:"10",r:"4"},
    // 焦距点
    {tag:"circle",cx:"10",cy:"10",r:"1"},
    // 手柄
    {tag:"line",x1:"15.5",y1:"15.5",x2:"21",y2:"21"},
    // 分析网格十字
    {tag:"line",x1:"5",y1:"10",x2:"6.5",y2:"10"},
    {tag:"line",x1:"13.5",y1:"10",x2:"15",y2:"10"},
    {tag:"line",x1:"10",y1:"5",x2:"10",y2:"6.5"},
    {tag:"line",x1:"10",y1:"13.5",x2:"10",y2:"15"},
  ]},
  cinematographer: { viewBox: "0 0 24 24", elements: [
    // Camera body
    {tag:"rect",x:"4",y:"7",width:"16",height:"12",rx:"2.5"},
    // Lens
    {tag:"circle",cx:"12",cy:"13",r:"4.5"},
    {tag:"circle",cx:"12",cy:"13",r:"2.5"},
    {tag:"circle",cx:"12",cy:"13",r:".8"},
    // Viewfinder
    {tag:"rect",x:"9",y:"4",width:"6",height:"3",rx:"1"},
    // Flash
    {tag:"rect",x:"16",y:"5",width:"3",height:"1.5",rx:".5"},
    // Aperture marks
    {tag:"line",x1:"9",y1:"9.5",x2:"9.5",y2:"10"},
    {tag:"line",x1:"14.5",y1:"16",x2:"15",y2:"16.5"},
    {tag:"line",x1:"8.5",y1:"16.5",x2:"9",y2:"16"},
    {tag:"line",x1:"15",y1:"10",x2:"15.5",y2:"9.5"},
  ]},
  sound: { viewBox: "0 0 24 24", elements: [
    // Speaker body
    {tag:"rect",x:"4",y:"8",width:"5",height:"8",rx:"1"},
    {tag:"polygon",points:"9,10 14,6 14,18 9,14"},
    // Sound waves
    {tag:"path",d:"M16 9.5c1.5 1 2.5 2.8 2.5 4.5s-1 3.5-2.5 4.5"},
    {tag:"path",d:"M18.5 7c2 1.3 3.5 3.5 3.5 5.5s-1.5 4.2-3.5 5.5"},
    // EQ bars
    {tag:"line",x1:"6",y1:"10",x2:"6",y2:"10.5"},
    {tag:"line",x1:"7",y1:"9.5",x2:"7",y2:"11"},
  ]},
  colorist: { viewBox: "0 0 24 24", elements: [
    // Color wheel
    {tag:"circle",cx:"12",cy:"12",r:"9"},
    {tag:"circle",cx:"12",cy:"12",r:"5.5"},
    {tag:"circle",cx:"12",cy:"12",r:"2"},
    // Color segments
    {tag:"path",d:"M12 3a9 9 0 0 1 0 18"},
    {tag:"path",d:"M12 3a9 9 0 0 0-4.5 1.2"},
    {tag:"path",d:"M3 12h4.5"},
    {tag:"path",d:"M18 12h3"},
    {tag:"path",d:"M7.5 7.5l3 3"},
    // Swatches
    {tag:"rect",x:"3",y:"19",width:"4",height:"3",rx:".5"},
    {tag:"rect",x:"8",y:"20",width:"4",height:"3",rx:".5"},
    {tag:"rect",x:"13",y:"19",width:"4",height:"3",rx:".5"},
    {tag:"rect",x:"18",y:"20",width:"4",height:"3",rx:".5"},
    // Center dot
    {tag:"circle",cx:"12",cy:"12",r:".6"},
  ]},
  canvas: { viewBox: "0 0 24 24", elements: [
    {tag:"circle",cx:"5",cy:"5",r:"1.2"},
    {tag:"circle",cx:"12",cy:"5",r:"1.3"},
    {tag:"circle",cx:"19",cy:"5",r:"1.2"},
    {tag:"circle",cx:"5",cy:"12",r:"1.2"},
    {tag:"circle",cx:"12",cy:"12",r:"1.6"},
    {tag:"circle",cx:"19",cy:"12",r:"1.2"},
    {tag:"circle",cx:"5",cy:"19",r:"1.2"},
    {tag:"circle",cx:"12",cy:"19",r:"1.3"},
    {tag:"circle",cx:"19",cy:"19",r:"1.2"},
    {tag:"line",x1:"6.2",y1:"12",x2:"10.5",y2:"12"},
    {tag:"line",x1:"13.5",y1:"12",x2:"17.8",y2:"12"},
    {tag:"line",x1:"6.2",y1:"5",x2:"10.8",y2:"5"},
    {tag:"line",x1:"13.2",y1:"5",x2:"17.8",y2:"5"},
    {tag:"line",x1:"6.2",y1:"19",x2:"10.8",y2:"19"},
    {tag:"line",x1:"13.2",y1:"19",x2:"17.8",y2:"19"},
    {tag:"line",x1:"5",y1:"6.2",x2:"5",y2:"10.8"},
    {tag:"line",x1:"19",y1:"6.2",x2:"19",y2:"10.8"},
    {tag:"line",x1:"6",y1:"6",x2:"10.5",y2:"10.5"},
    {tag:"line",x1:"13.5",y1:"13.5",x2:"18",y2:"18"},
    {tag:"rect",x:"1.5",y:"1.5",width:"21",height:"21",rx:"3"},
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

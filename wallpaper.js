'use strict';
// 画像生成APIは使わず、入力済みの文字を端末内のCanvasへ描く。
const TripWallpaper = (() => {
  const W=1080,H=1920,LEFT=120,WIDTH=840,TOP=370,BOTTOM=1750;
  const FONT='"Hiragino Sans", "Yu Gothic", sans-serif';
  const settingsKey='trip-wallpaper-settings-v1';
  let background;
  const labels={dates:'旅行の日',members:'いっしょに行く人',wishes:'みんなの楽しみ',morning:'朝の予定',lunch:'お昼とひと休み',afternoon:'午後の予定',evening:'夜の予定',meeting:'待ち合わせ'};
  const defaults=new Set(Object.keys(labels));
  const segments=text=>typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(text)].map(x=>x.segment):Array.from(text);
  function lines(ctx,text,width){
    const result=[];
    for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){
      let line='';
      for(const character of segments(paragraph)){
        if(line&&ctx.measureText(line+character).width>width){result.push(line);line=character;}
        else line+=character;
      }
      result.push(line);
    }
    return result;
  }
  function pages(ctx,entries){
    const output=[[]];let y=TOP;
    for(const [label,value] of entries){
      ctx.font=`500 44px ${FONT}`;
      const wrapped=lines(ctx,value,WIDTH);let offset=0;
      while(offset<wrapped.length){
        // 1項目の先頭はラベルと本文2行分をなるべく同じページへ。
        if(BOTTOM-y<42+Math.min(2,wrapped.length-offset)*60){output.push([]);y=TOP;}
        const count=Math.min(wrapped.length-offset,Math.floor((BOTTOM-y-42)/60));
        const part=wrapped.slice(offset,offset+count);
        output[output.length-1].push({label:label+(offset?'（つづき）':''),lines:part,y});
        y+=42+part.length*60+140;offset+=count;
        if(offset<wrapped.length){output.push([]);y=TOP;}
      }
    }
    return output;
  }
  function loadBackground(){
    if(!background)background=new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{background=null;reject(new Error('背景を読み込めませんでした。もう一度お試しください。'));};
      img.src='amusement-park-background-v3.png';
    });
    return background;
  }
  function paintBackground(ctx,img){
    // 元の絵の形を保ち、白い下地に45%の濃さで重ねる。
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.save();ctx.globalAlpha=.45;
    const ratio=W/img.naturalWidth,topCut=img.naturalHeight*.25,bottomCut=img.naturalHeight*.65;
    const topHeight=topCut*ratio,bottomHeight=(img.naturalHeight-bottomCut)*ratio;
    ctx.drawImage(img,0,topCut,img.naturalWidth,bottomCut-topCut,0,topHeight,W,H-topHeight-bottomHeight);
    ctx.drawImage(img,0,0,img.naturalWidth,topCut,0,0,W,topHeight);
    ctx.drawImage(img,0,bottomCut,img.naturalWidth,img.naturalHeight-bottomCut,0,H-bottomHeight,W,bottomHeight);
    ctx.restore();
  }
  async function draw(entries,title,onlyPage=null){
    const img=await loadBackground();if(document.fonts)await document.fonts.ready;
    const measure=document.createElement('canvas').getContext('2d');
    const content=pages(measure,entries),canvases=[];
    const selected=onlyPage===null?[...content.entries()]:[[onlyPage,content[onlyPage]]];
    for(const [i,blocks] of selected){
      const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
      const ctx=canvas.getContext('2d');paintBackground(ctx,img);
      ctx.textBaseline='top';ctx.fillStyle='#78608e';ctx.textAlign='center';
      ctx.font=`600 28px ${FONT}`;ctx.fillText('わが家の旅のしおり',W/2,85);
      ctx.fillStyle='#493d5d';let titleSize=64;
      do{ctx.font=`700 ${titleSize}px ${FONT}`;if(ctx.measureText(title).width<=WIDTH)break;titleSize-=2;}while(titleSize>30);
      const titleLines=lines(ctx,title,WIDTH);
      titleLines.forEach((line,n)=>ctx.fillText(line,W/2,140+n*43));
      ctx.strokeStyle='#bba4c8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(LEFT+110,280);ctx.lineTo(W-LEFT-110,280);ctx.stroke();
      ctx.textAlign='left';
      for(const block of blocks){
        ctx.fillStyle='#866496';ctx.font=`600 30px ${FONT}`;ctx.fillText(block.label,LEFT,block.y);
        ctx.fillStyle='#403b50';ctx.font=`500 44px ${FONT}`;
        block.lines.forEach((line,n)=>ctx.fillText(line,LEFT,block.y+42+n*60));
      }
      ctx.textAlign='center';ctx.fillStyle='#78608e';ctx.font=`500 24px ${FONT}`;
      ctx.fillText(content.length>1?`${i+1} / ${content.length}`:'Have a lovely trip',W/2,1820);
      canvases.push(canvas);
    }
    canvases.pageCount=content.length;
    return canvases;
  }
  function mount(host,fields,data){
    let stored={};try{const parsed=JSON.parse(localStorage.getItem(settingsKey)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))stored=parsed;}catch{}
    const root=document.createElement('section');root.className='wallpaper-maker no-print';
    const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
    root.append(make('div','MY TRIP WALLPAPER','eyebrow'),make('h3','旅のしおりを、待受に。'),make('p','淡い遊園地のイラストに、決めた予定を重ねられます。上下の余白を抑えた9:16の縦長サイズです。','desc'));
    const nameWrap=make('div',null,'field'),nameLabel=make('label','しおりのタイトル'),name=make('input');
    name.id='wallpaper-title';name.type='text';name.maxLength=24;name.value=typeof stored.title==='string'?stored.title.slice(0,24):'わくわく家族旅行';nameLabel.htmlFor=name.id;
    nameWrap.append(nameLabel,name);root.append(nameWrap);
    const details=make('details'),summary=make('summary','画像に載せる項目を選ぶ');details.append(summary);
    const options=make('div',null,'wallpaper-options');const checks=[];
    for(const [id,label]of fields){if(!(data[id]||'').trim())continue;
      const wrap=make('label'),check=make('input');check.type='checkbox';check.checked=Array.isArray(stored.selected)?stored.selected.includes(id):defaults.has(id);check.value=id;
      wrap.append(check,make('span',labels[id]||label));options.append(wrap);checks.push([id,label,check]);
    }
    if(!checks.length)options.append(make('p','先に旅行日や予定を入力してね。'));
    details.append(options);root.append(details);
    const build=make('button','しおり画像を作る','primary');build.type='button';
    const status=make('p','','wallpaper-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const previews=make('div',null,'wallpaper-previews');
    root.append(build,status,previews,make('p','文字が多い場合は、読める大きさのまま複数枚に分けます。画像は1080 × 1920 px（9:16）。機種や壁紙の設定によって見える範囲が変わります。','save-note'));
    let revision=0;const invalidate=()=>{revision++;previews.replaceChildren();try{localStorage.setItem(settingsKey,JSON.stringify({title:name.value,selected:checks.filter(([, ,c])=>c.checked).map(([id])=>id)}));}catch{}status.textContent='内容を変えたので「しおり画像を作る」を押してね。';};
    name.addEventListener('input',invalidate);checks.forEach(([, ,c])=>c.addEventListener('change',invalidate));
    build.addEventListener('click',async()=>{
      const entries=checks.filter(([, ,c])=>c.checked).map(([id,label])=>[labels[id]||label,data[id].trim()]);
      if(!entries.length){status.textContent='画像に載せる項目を1つ以上選んでね。';return;}
      const current=++revision;build.disabled=true;status.textContent='しおりを作っています…';previews.replaceChildren();
      try{
        const title=name.value.trim()||'わくわく家族旅行';
        const renderPage=async(page=0)=>{
        const canvases=await draw(entries,title,page);
        if(current!==revision)return;
        previews.replaceChildren();
        for(const canvas of canvases){const i=page;
          const figure=make('figure',null,'wallpaper-figure'),img=make('img');img.src=canvas.toDataURL('image/png');img.alt=`入力した予定入りの旅のしおり ${i+1}枚目`;img.width=W;img.height=H;
          const save=make('a',`${i+1}枚目を画像で保存`,'wallpaper-download');save.href=img.src;save.download=`旅のしおり-${i+1}.png`;
          const open=make('a','大きく開く');open.href=img.src;open.target='_blank';open.rel='noopener';
          const actions=make('div',null,'wallpaper-actions');actions.append(save,open);
          if(navigator.share&&navigator.canShare){
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
            if(blob){const file=new File([blob],`旅のしおり-${i+1}.png`,{type:'image/png'});
              if(navigator.canShare({files:[file]})){
                const share=make('button','共有して保存','secondary');share.type='button';share.addEventListener('click',async()=>{try{await navigator.share({files:[file]});}catch(error){if(error.name!=='AbortError')status.textContent='共有できませんでした。「画像で保存」か、画像の長押しをお試しください。';}});actions.append(share);
              }
            }
          }
          figure.append(img,make('figcaption',`${i+1} / ${canvases.pageCount}`),actions);previews.append(figure);
        }
        if(canvases.pageCount>1){
          const nav=make('div',null,'wallpaper-actions');
          for(const [label,next]of [['前の画像',page-1],['次の画像',page+1]]){
            const button=make('button',label,'secondary');button.type='button';button.disabled=next<0||next>=canvases.pageCount;
            button.addEventListener('click',async()=>{button.disabled=true;try{await renderPage(next);}catch{status.textContent='画像を表示できませんでした。もう一度「しおり画像を作る」を押してね。';}});nav.append(button);
          }
          previews.append(nav);
        }
        status.textContent=`${canvases.pageCount}枚のしおりができました。${canvases.pageCount>1?'前後の画像へ切り替えて、1枚ずつ保存できます。':''}iPhoneでは画像を長押しして写真へ保存する方法も使えます。`;
        };
        await renderPage();
      }catch(error){if(current===revision)status.textContent=error.message||'画像を作れませんでした。もう一度お試しください。';}
      finally{build.disabled=false;}
    });
    host.append(root);
  }
  function reset(){try{localStorage.removeItem(settingsKey);}catch{}}
  return {mount,draw,lines,pages,reset,width:W,height:H};
})();

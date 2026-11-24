'use strict';
// 全25項目を5テーマの画像へ。入力の外部送信やAIへの問い合わせは行わない。
const TripWallpaper = (() => {
  const W=1080,MIN_H=1920,MAX_H=4096,LEFT=120,WIDTH=840,TOP=370,BOTTOM_SPACE=140;
  const FONT='"Hiragino Sans", "Yu Gothic", sans-serif';
  const settingsKey='trip-wallpaper-settings-v1';
  let background,disposeCurrent=()=>{};
  const labels={dates:'旅行の日',members:'いっしょに行く人',wishes:'みんなの楽しみ',morning:'朝の予定',lunch:'お昼とひと休み',afternoon:'午後の予定',evening:'夜の予定',meeting:'待ち合わせ'};
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
  function buildSet(sections,data){
    if(sections.length!==5)throw new Error('5つのテーマを読み込めませんでした。ページを開き直してください。');
    return sections.map(section=>({title:section.title,entries:section.fields.map(([id,label])=>({id,label:labels[id]||label,value:typeof data[id]==='string'&&data[id].trim()?data[id].trim():'これから決める'}))}));
  }
  function layout(ctx,entries){
    function measure(fontSize){
      const lineHeight=fontSize*1.4,gap=34;
      let y=TOP;
      const blocks=entries.map(entry=>{
        ctx.font='600 28px '+FONT;const labelLines=lines(ctx,entry.label,WIDTH);
        ctx.font='500 '+fontSize+'px '+FONT;const textLines=lines(ctx,entry.value,WIDTH);
        const block={...entry,labelLines,lines:textLines,y,textY:y+labelLines.length*36+8,fontSize,lineHeight};
        y=block.textY+textLines.length*lineHeight+gap;
        return block;
      });
      return {blocks,needed:y-gap+BOTTOM_SPACE};
    }
    let result=measure(42);
    const height=Math.max(MIN_H,Math.min(MAX_H,Math.ceil(result.needed)));
    if(result.needed>MAX_H){
      // 極端な長文は画像を無制限に大きくせず、文字も縮小して全て残す。
      let lo=.01,hi=42;
      for(let n=0;n<20;n++){const middle=(lo+hi)/2;if(measure(middle).needed<=MAX_H)lo=middle;else hi=middle;}
      result=measure(lo);
    }
    const free=Math.max(0,height-result.needed);
    const extra=result.blocks.length>1?Math.min(110,free/(result.blocks.length-1)):0;
    result.blocks.forEach((block,index)=>{block.y+=extra*index;block.textY+=extra*index;});
    return {height,blocks:result.blocks};
  }
  function loadBackground(){
    if(!background)background=new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{background=null;reject(new Error('背景を読み込めませんでした。下のボタンでもう一度お試しください。'));};
      img.src='amusement-park-background-v3.png';
    });
    return background;
  }
  function paintBackground(ctx,img,height){
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,height);ctx.save();ctx.globalAlpha=.45;
    const ratio=W/img.naturalWidth,topCut=img.naturalHeight*.25,bottomCut=img.naturalHeight*.65;
    const topHeight=topCut*ratio,bottomHeight=(img.naturalHeight-bottomCut)*ratio;
    ctx.drawImage(img,0,topCut,img.naturalWidth,bottomCut-topCut,0,topHeight,W,height-topHeight-bottomHeight);
    ctx.drawImage(img,0,0,img.naturalWidth,topCut,0,0,W,topHeight);
    ctx.drawImage(img,0,bottomCut,img.naturalWidth,img.naturalHeight-bottomCut,0,height-bottomHeight,W,bottomHeight);
    ctx.restore();
  }
  function drawCard(group,index,title,img){
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    const placed=layout(ctx,group.entries);canvas.width=W;canvas.height=placed.height;
    paintBackground(ctx,img,canvas.height);ctx.textBaseline='top';ctx.textAlign='center';
    ctx.fillStyle='#78608e';ctx.font='600 28px '+FONT;ctx.fillText('わが家の旅のしおり',W/2,85);
    ctx.fillStyle='#493d5d';let titleSize=64;
    do{ctx.font='700 '+titleSize+'px '+FONT;if(ctx.measureText(title).width<=WIDTH)break;titleSize-=2;}while(titleSize>30);
    lines(ctx,title,WIDTH).forEach((line,n)=>ctx.fillText(line,W/2,140+n*43));
    ctx.fillStyle='#866496';ctx.font='600 30px '+FONT;ctx.fillText(group.title,W/2,245);
    ctx.strokeStyle='#bba4c8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(LEFT+110,310);ctx.lineTo(W-LEFT-110,310);ctx.stroke();
    ctx.textAlign='left';
    for(const block of placed.blocks){
      ctx.fillStyle='#866496';ctx.font='600 28px '+FONT;block.labelLines.forEach((line,n)=>ctx.fillText(line,LEFT,block.y+n*36));
      ctx.fillStyle=block.value==='これから決める'?'#83798d':'#403b50';ctx.font='500 '+block.fontSize+'px '+FONT;
      block.lines.forEach((line,n)=>ctx.fillText(line,LEFT,block.textY+n*block.lineHeight));
    }
    ctx.textAlign='center';ctx.fillStyle='#78608e';ctx.font='500 24px '+FONT;
    ctx.fillText((index+1)+' / 5',W/2,canvas.height-90);
    return canvas;
  }
  function mount(host,sections,data){
    disposeCurrent();
    let stored={};try{const parsed=JSON.parse(localStorage.getItem(settingsKey)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))stored=parsed;}catch{}
    const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
    const root=make('section',null,'wallpaper-maker no-print');
    root.append(make('div','MY TRIP ALBUM','eyebrow'),make('h3','旅のしおり、5枚セット'),make('p','入力したメモを5つのテーマごとに画像にまとめます。長いメモは画像を縦に伸ばして、全文を載せます。','desc'));
    const nameWrap=make('div',null,'field'),nameLabel=make('label','しおりのタイトル'),name=make('input');
    name.id='wallpaper-title';name.type='text';name.maxLength=24;name.value=typeof stored.title==='string'?stored.title.slice(0,24):'わくわく家族旅行';nameLabel.htmlFor=name.id;
    nameWrap.append(nameLabel,name);root.append(nameWrap);
    const status=make('p',null,'wallpaper-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const previews=make('div',null,'wallpaper-previews');
    const share=make('button','5枚まとめて共有・保存','primary');share.type='button';share.hidden=true;
    const retry=make('button','もう一度画像を作る','secondary');retry.type='button';retry.hidden=true;
    const dialog=make('dialog',null,'wallpaper-dialog no-print'),dialogTitle=make('h3'),large=make('img'),close=make('button','閉じる','secondary');
    close.type='button';close.addEventListener('click',()=>dialog.close());dialog.append(dialogTitle,large,close);
    root.append(status,previews,share,retry,make('p','画像は横1080px。文章量に合わせて縦の長さと文字の大きさを調整します。空欄は「これから決める」と表示されます。','save-note'),dialog);
    host.append(root);
    let revision=0,timer,urls=[],files=[];
    const revoke=()=>{urls.forEach(url=>URL.revokeObjectURL(url));urls=[];};
    disposeCurrent=()=>{revision++;clearTimeout(timer);revoke();files=[];if(dialog.open)dialog.close();root.remove();};
    async function generate(){
      const current=++revision;revoke();files=[];share.hidden=true;retry.hidden=true;previews.replaceChildren();status.textContent='5枚のしおりを作っています…';
      try{
        const groups=buildSet(sections,data),img=await loadBackground();if(document.fonts)await document.fonts.ready;
        for(const [index,group]of groups.entries()){
          if(current!==revision||!root.isConnected)return;
          const canvas=drawCard(group,index,name.value.trim()||'わくわく家族旅行',img);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('画像を保存できませんでした。もう一度お試しください。');
          if(current!==revision||!root.isConnected)return;
          const url=URL.createObjectURL(blob);urls.push(url);
          const filename='旅のしおり-'+String(index+1).padStart(2,'0')+'-'+group.title+'.png';files.push(new File([blob],filename,{type:'image/png'}));
          const figure=make('figure',null,'wallpaper-figure'),preview=make('img');preview.src=url;preview.alt=group.title+'のしおり '+(index+1)+' / 5';preview.width=canvas.width;preview.height=canvas.height;
          const save=make('a','画像を保存','wallpaper-download');save.href=url;save.download=filename;
          const open=make('button','大きく見る','wallpaper-open');open.type='button';open.addEventListener('click',()=>{dialogTitle.textContent=group.title+'（'+(index+1)+' / 5）';large.src=url;large.alt=preview.alt;dialog.showModal();});
          const actions=make('div',null,'wallpaper-actions');actions.append(save,open);figure.append(make('figcaption',(index+1)+' / 5　'+group.title),preview,actions);previews.append(figure);
          status.textContent=(index+1)+' / 5 枚を作成しました。';
        }
        if(current!==revision||!root.isConnected)return;
        status.textContent='5枚のしおりができました。画像ごとに保存できます。iPhoneでは画像の長押しでも保存できます。';
        try{share.hidden=!(navigator.share&&navigator.canShare&&navigator.canShare({files}));}catch{share.hidden=true;}
      }catch(error){if(current===revision){status.textContent='画像を作れませんでした。「もう一度画像を作る」を押してね。';retry.hidden=false;}}
    }
    name.addEventListener('input',()=>{try{localStorage.setItem(settingsKey,JSON.stringify({title:name.value}));}catch{}revision++;revoke();previews.replaceChildren();share.hidden=true;status.textContent='タイトルを反映しています…';clearTimeout(timer);timer=setTimeout(generate,250);});
    retry.addEventListener('click',generate);
    share.addEventListener('click',async()=>{try{await navigator.share({files});}catch(error){if(error.name!=='AbortError')status.textContent='まとめて共有できませんでした。各画像の「画像を保存」をお使いください。';}});
    void generate();
  }
  function dispose(){disposeCurrent();disposeCurrent=()=>{};}
  function reset(){dispose();try{localStorage.removeItem(settingsKey);}catch{}}
  return {mount,buildSet,layout,lines,dispose,reset,width:W,minHeight:MIN_H,maxHeight:MAX_H};
})();

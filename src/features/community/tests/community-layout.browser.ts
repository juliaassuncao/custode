// Same-origin iframe viewports exercise real CSS without changing the reader's styles.
export async function runCommunityLayoutTests() {
  if (!import.meta.env.DEV || !['localhost','127.0.0.1'].includes(location.hostname)) throw new Error('Local Vite required');
  const frame = document.createElement('iframe');
  frame.title = 'Verificação temporária de layout';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;height:1000px;border:0;width:1280px;';
  frame.src = '/capitulo/1';
  document.body.append(frame);
  const results: {width:number;theme:string;overflow:boolean;cloverDirection:string}[] = [];
  const luminance = (color: string) => {
    const values = color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n => {
      const channel=n/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
    });
    return .2126*values[0]+.7152*values[1]+.0722*values[2];
  };
  const contrast = (foreground: string, background: string) => {
    const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
    return (values[0]+.05)/(values[1]+.05);
  };
  try {
    await new Promise<void>((resolve,reject) => { frame.onload=()=>resolve();frame.onerror=()=>reject(new Error('Frame failed')); });
    const doc=frame.contentDocument!;
    const view=frame.contentWindow!;
    for(let i=0;i<100;i++) {
      const button=doc.querySelector<HTMLButtonElement>('.chapter-clover');
      if(button && (!button.disabled || button.classList.contains('chapter-clover--active'))) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    const community=doc.querySelector<HTMLElement>('.chapter-community');
    if(!community || !doc.querySelector('.community-comment')) throw new Error('Local chapter 1 fixture/homologation comment required');
    if(doc.querySelector('.reader__end')?.nextElementSibling!==community) throw new Error('Community placement changed');
    // Public comment text only, changed in this disposable frame to test long input layout.
    doc.querySelector('.community-comment__body')!.textContent='W'.repeat(5000);
    doc.querySelector('.community-comment h4')!.textContent='W'.repeat(40);
    const clover=doc.querySelector<HTMLButtonElement>('.chapter-clover')!;
    const cloverSection=doc.querySelector<HTMLElement>('.chapter-community__clover')!;
    if(!cloverSection.nextElementSibling?.classList.contains('chapter-community__heading')) throw new Error('Clover must precede Comments');
    const originalLogo=new DOMParser().parseFromString(await (await fetch('/custode-trevo.svg')).text(),'image/svg+xml');
    const originalLeaves=[...originalLogo.querySelectorAll('g > path')].slice(1).map(path=>path.getAttribute('d'));
    const iconLeaves=[...cloverSection.querySelectorAll('svg > g > path')].map(path=>path.getAttribute('d'));
    if(JSON.stringify(originalLeaves)!==JSON.stringify(iconLeaves)) throw new Error('Brand leaves changed or stem remains');
    for(const width of [280,320,390,768,1280]) {
      frame.style.width=`${width}px`;
      for(const theme of ['light','dark']) {
        doc.documentElement.dataset.theme=theme;
        const overflow=doc.documentElement.scrollWidth>view.innerWidth;
        if(overflow) throw new Error(`Horizontal overflow at ${width}px/${theme}`);
        for(const field of community.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select')) {
          if(!field.labels?.length) throw new Error('Missing visible field label');
          if(field.tagName!=='SELECT') {
            const fieldStyle=view.getComputedStyle(field);
            const border=fieldStyle.borderTopColor.match(/[\d.]+/g)!.slice(0,3).map(Number);
            if(border[0]>border[1] || border[2]>border[1]) throw new Error(`Reddish field border at ${theme}`);
            field.setAttribute('aria-invalid','true');
            if(view.getComputedStyle(field).borderTopColor!==fieldStyle.borderTopColor) throw new Error('Invalid field has unwanted error border');
            field.setAttribute('aria-invalid','false');
            const placeholder=view.getComputedStyle(field,'::placeholder');
            if(placeholder.opacity!=='1' || contrast(placeholder.color,view.getComputedStyle(field).backgroundColor)<4.5) throw new Error(`Placeholder contrast below AA at ${theme}`);
          }
        }
        const avatar=view.getComputedStyle(community.querySelector('.community-avatar')!);
        if(contrast(avatar.color,avatar.backgroundColor)<4.5) throw new Error(`Avatar contrast below AA at ${theme}`);
        for(const button of community.querySelectorAll<HTMLButtonElement>('button')) {
          if(button.getBoundingClientRect().height<44) throw new Error('Small button target');
        }
        const direction=view.getComputedStyle(community.querySelector('.chapter-clover-summary')!).flexDirection;
        const svg = cloverSection.querySelector('svg')!;
        if(svg.getBoundingClientRect().width < parseFloat(view.getComputedStyle(cloverSection.querySelector('.chapter-community__count')!).fontSize)) throw new Error('Clover icon smaller than count');
        for(const active of [false,true]) {
          clover.classList.toggle('chapter-clover--active',active);
          cloverSection.classList.toggle('chapter-community__clover--active',active);
          clover.querySelector('.chapter-clover__label')!.textContent=active?'Você deixou um trevo':'Deixar um trevo';
          if((view.getComputedStyle(svg).fill==='none')===active) throw new Error('Clover fill does not match participation');
          if(doc.documentElement.scrollWidth>view.innerWidth) throw new Error(`Clover state overflow at ${width}px/${theme}`);
        }
        results.push({width:view.innerWidth,theme,overflow,cloverDirection:direction});
      }
    }
    return {passed:true,results};
  } finally { frame.remove(); }
}

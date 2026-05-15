import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Line, Circle, Rect, Polygon, Font, Defs, G } from '@react-pdf/renderer';
import { THEMES } from '../../constants/themes';

// Register Anton for thick comic-like headers
Font.register({
  family: 'Anton',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm3Kz-Co.ttf', fontWeight: 400 }
  ]
});

// Register Nunito for readable comic body text
Font.register({
  family: 'Nunito',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTQ3ig.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3ig.ttf', fontWeight: 500 }, 
    { src: 'https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDFwmdTQ3ig.ttf', fontWeight: 700 }, 
    { src: 'https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDBImdTQ3ig.ttf', fontWeight: 900 }  
  ]
});

// Cairo for Arabic
Font.register({
  family: 'Cairo',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-a1PiKQ.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5a1PiKQ.ttf', fontWeight: 700 },
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hEk5a1PiKQ.ttf', fontWeight: 900 }
  ]
});

const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);
const getFontFamily = (text: string, defaultFont = 'Nunito', isHeading = false) => isArabic(text) ? 'Cairo' : (isHeading ? 'Anton' : defaultFont);

const prepareInteractiveSyntax = (text: string) => {
  if (!text) return "";
  let t = String(text);
  t = t.replace(/<term\s+title=(?:'|")([^'"]+)(?:'|")[^>]*>([\s\S]*?)<\/term>/g, "**$2**");
  t = t.replace(/<term[^>]*>([\s\S]*?)<\/term>/g, "**$1**");
  t = t.replace(/\{\{(.*?)\|(.*?)\}\}/g, "**$1** ($2)");
  t = t.replace(/!!(.*?)\|(.*?)!!/g, "**$1** ($2)");
  t = t.replace(/>>(.*?)\|(.*?)<</g, "**$1**: $2");
  t = t.replace(/\(\((.*?)\|(.*?)\)\)/g, "**$2**");
  t = t.replace(/\?\?(.*?)\|(.*?)\?\?/g, "**$1**");
  t = t.replace(/%%(.*?)\|(.*?)%%/g, "**$1** ($2)");
  t = t.replace(/~~(.*?)\|(.*?)~~/g, "**$2**");
  t = t.replace(/\^\^(.*?)\|(.*?)\^\^/g, "**$1** [$2]");
  t = t.replace(/\*\*([^*|]+)\|([^*|]+)\*\*/g, "**$1** ($2)");
  t = t.replace(/\[\[Match\|(.*?)\]\]/g, "__________");
  t = t.replace(/\(\(\(\w+\|(.*?)\)\)\)/g, "**$1**");
  return t;
};

const SuperheroRichText = ({ text, baseStyle, docColors, isHeading=false }: { text: string; baseStyle: any; docColors?: any, isHeading?: boolean }): any => {
  if (!text) return <Text style={baseStyle}>{" "}</Text>;
  const processed = prepareInteractiveSyntax(text);
  const parts = processed.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|==.*?==|@@[^@]+@@)/g);

  if (parts.length === 1 && !processed.match(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|==.*?==|@@[^@]+@@)/)) {
    return <Text style={{ ...baseStyle, fontFamily: getFontFamily(processed, baseStyle.fontFamily, isHeading) }}>{processed}</Text>;
  }

  return (
    <Text style={baseStyle}>
      {parts.filter(Boolean).map((part, i) => {
        let style: any = {
          ...baseStyle,
          fontWeight: baseStyle?.fontWeight || (isHeading ? 400 : 500),
          color: baseStyle?.color || '#000000', 
          fontFamily: getFontFamily(part, baseStyle?.fontFamily, isHeading)
        };

        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
          const content = part.slice(2, -2);
          return <SuperheroRichText key={i} text={content} baseStyle={{ ...style, fontWeight: 900, color: docColors?.primary || '#E50914' }} docColors={docColors} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <SuperheroRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: docColors?.highlight || '#FFEB3B', fontWeight: 700, paddingHorizontal: 2 }} docColors={docColors} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          return <SuperheroRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: docColors?.primary || '#E50914', color: '#FFF', paddingVertical: 2, paddingHorizontal: 4 }} docColors={docColors} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = '#FFF'; 
          style.fontFamily = 'Courier';
          style.fontWeight = 700;
          style.backgroundColor = '#000';
          return <Text key={i} style={style}>{content}</Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.fontWeight = 900;
          style.color = docColors?.secondary || '#0052CC'; 
          return <Text key={i} style={style}>{`[Photo: ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

// Comic Burst Shape
const JaggedBurst = ({ color = "#E50914" }) => (
  <Path d="M 50 5 L 62 25 L 90 15 L 75 38 L 98 50 L 72 65 L 85 90 L 58 78 L 45 98 L 35 75 L 10 90 L 25 60 L 5 45 L 30 35 L 15 10 L 40 22 Z" fill={color} stroke="#000" strokeWidth="4" strokeLinejoin="round" />
);

const CitySkyline = ({ color = "#000" }) => (
  <Path d="M 0 842 L 0 680 L 25 680 L 25 620 L 45 620 L 45 650 L 70 650 L 70 540 L 95 540 L 95 600 L 115 600 L 115 500 L 145 500 L 145 570 L 175 570 L 175 480 L 200 480 L 200 600 L 235 600 L 235 450 L 265 450 L 265 550 L 300 550 L 300 650 L 330 650 L 330 520 L 365 520 L 365 580 L 395 580 L 395 480 L 425 480 L 425 600 L 460 600 L 460 550 L 485 550 L 485 680 L 515 680 L 515 630 L 540 630 L 540 700 L 570 700 L 570 650 L 595 650 L 595 842 Z" fill={color} />
);

const SuperheroBlockRenderer = ({ block, docColors, index }: { block: PdfBlock, docColors: any, index: number }) => {
  if (!block) return <View />;
  const content = block.content || '';
  const isRtl = isArabic(prepareInteractiveSyntax(content));

  const styleVariants = [
    { bg: '#FFFFFF', rot: -1 },
    { bg: '#FFFCE0', rot: 0.5 },
    { bg: '#F0F8FF', rot: -0.5 },
    { bg: '#FFEBEA', rot: 1 },
    { bg: '#F8F8F8', rot: 0 },
  ];
  const borderVariants = [
    { wTop: 4, wRight: 2, wBottom: 4, wLeft: 2 },
    { wTop: 2, wRight: 4, wBottom: 2, wLeft: 5 },
    { wTop: 3, wRight: 2, wBottom: 5, wLeft: 3 },
  ];

  const sv = styleVariants[index % styleVariants.length];
  const bv = borderVariants[index % borderVariants.length];

  const cTypes = ['classic', 'speech', 'action', 'taped', 'inset'];
  const assignedType = cTypes[index % cTypes.length]; // cycle through types for plain text

  const renderDynamicContainer = (children: any, type: string, overrideStyle: any = {}) => {
    if (type === 'speech') {
      return (
        <View wrap={false} style={{ marginBottom: 35, position: 'relative', transform: `rotate(${sv.rot}deg)`, ...overrideStyle }}>
          <View style={{ position: 'absolute', top: 5, left: 5, right: -5, bottom: -5, backgroundColor: '#000', borderRadius: 20 }} />
          <View style={{ backgroundColor: sv.bg, borderRadius: 20, border: '4px solid #000', padding: 16 }}>
            {children}
          </View>
          <View style={{ position: 'absolute', bottom: -20, left: 40 }}>
             <Svg width="30" height="30" viewBox="0 0 100 100">
                <Path d="M0,0 L100,0 L0,100 Z" fill={sv.bg} />
                <Path d="M0,0 L0,100 L100,0" stroke="#000" strokeWidth="12" fill="none" />
             </Svg>
          </View>
        </View>
      );
    }
    if (type === 'action') {
      const tilt = index % 2 === 0 ? 3 : -3;
      return (
        <View wrap={false} style={{ marginBottom: 25, transform: `skewX(${-tilt}deg)`, position: 'relative', ...overrideStyle }}>
          <View style={{ position: 'absolute', top: 6, left: 6, right: -6, bottom: -6, backgroundColor: docColors.primary }} />
          <View style={{ backgroundColor: sv.bg, border: '4px solid #000', padding: 16 }}>
            <View style={{ transform: `skewX(${tilt}deg)` }}>
              {children}
            </View>
          </View>
        </View>
      );
    }
    if (type === 'taped') {
       return (
        <View wrap={false} style={{ marginBottom: 25, position: 'relative', transform: `rotate(${sv.rot * 2}deg)`, marginTop: 15, ...overrideStyle }}>
           <View style={{ backgroundColor: sv.bg, border: '3px dashed #000', padding: 16 }}>
              {children}
           </View>
           {/* Tape piece */}
           <View style={{ position: 'absolute', top: -12, left: '50%', width: 100, marginLeft: -50, height: 30, backgroundColor: '#EEE', opacity: 0.9, border: '1px solid #AAA', transform: `rotate(${index % 2 === 0 ? -4 : 4}deg)` }}>
              <View style={{ position: 'absolute', top: 4, left: 0, right: 0, bottom: 4, borderTop: '1px solid #CCC', borderBottom: '1px solid #CCC' }} />
           </View>
        </View>
      );
    }
    if (type === 'inset') {
       return (
         <View wrap={false} style={{ marginBottom: 25, position: 'relative', transform: `rotate(${sv.rot}deg)`, ...overrideStyle }}>
           <View style={{ backgroundColor: docColors.secondary, padding: 8, border: '5px solid #000' }}>
              <View style={{ backgroundColor: sv.bg, border: '3px solid #000', padding: 16 }}>
                {children}
              </View>
           </View>
         </View>
       );
    }
    // classic
    return (
      <View wrap={false} style={{ marginBottom: 25, position: 'relative', transform: `rotate(${sv.rot}deg)`, ...overrideStyle }}>
        <View style={{ position: 'absolute', top: 6, left: 6, right: -6, bottom: -6, backgroundColor: '#000' }} />
        <View style={{ backgroundColor: sv.bg, borderTopWidth: bv.wTop, borderRightWidth: bv.wRight, borderBottomWidth: bv.wBottom, borderLeftWidth: bv.wLeft, borderColor: '#000', padding: 16 }}>
          {children}
        </View>
      </View>
    );
  };

  switch (block.type) {
    case 'heading':
      return (
        <View wrap={false} style={{ marginBottom: 20, marginTop: 24, alignItems: isRtl ? 'flex-end' : 'flex-start', transform: `rotate(${(index % 2 === 0) ? -2 : 2}deg)` }}>
           <View style={{ position: 'relative' }}>
               <View style={{ position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, backgroundColor: '#000' }} />
               <View style={{ backgroundColor: docColors.primary, border: '3px solid #000', paddingVertical: 8, paddingHorizontal: 16 }}>
                 <SuperheroRichText isHeading text={content} baseStyle={{ fontSize: 26, fontFamily: 'Anton', color: '#FFF', textTransform: 'uppercase', letterSpacing: 1 }} docColors={docColors} />
               </View>
           </View>
        </View>
      );
    case 'subheading':
      return (
        <View wrap={false} style={{ marginTop: 20, marginBottom: 12, alignItems: isRtl ? 'flex-end' : 'flex-start', marginLeft: 10 }}>
          <View style={{ position: 'relative' }}>
              <View style={{ position: 'absolute', top: 3, left: 3, right: -3, bottom: -3, backgroundColor: '#000' }} />
              <View style={{ backgroundColor: docColors.highlight, border: '2px solid #000', paddingVertical: 4, paddingHorizontal: 16, transform: 'skewX(-10deg)' }}>
                <View style={{ transform: 'skewX(10deg)' }}>
                   <SuperheroRichText isHeading text={content} baseStyle={{ fontSize: 18, fontFamily: 'Anton', color: '#000', textAlign: isRtl ? 'right' : 'left', letterSpacing: 0.5, textTransform: 'uppercase' }} docColors={docColors} />
                </View>
              </View>
          </View>
        </View>
      );
    case 'subtitle':
      return (
        <View wrap={false} style={{ marginTop: 12, marginBottom: 8, alignSelf: isRtl ? 'flex-end' : 'flex-start' }}>
          <SuperheroRichText text={content} baseStyle={{ fontSize: 13, fontFamily: 'Nunito', fontWeight: 900, color: docColors.secondary, textAlign: isRtl ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: 1 }} docColors={docColors} />
        </View>
      );
    case 'paragraph':
    case 'text':
    case 'plain':
      if (content.trim() === '') return <View style={{ height: 10 }} />;
      return renderDynamicContainer(
        <SuperheroRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Nunito', lineHeight: 1.5, color: '#000', textAlign: isRtl ? 'right' : 'left' }} docColors={docColors} />,
        assignedType
      );
    case 'example': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginBottom: 25, position: 'relative', paddingTop: 12 }}>
           <View style={{ position: 'absolute', top: 16, left: 4, right: -4, bottom: -4, backgroundColor: '#000' }} />
           <View style={{ backgroundColor: sv.bg, border: '4px solid #000', padding: 16 }}>
              <SuperheroRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Nunito', color: '#000', lineHeight: 1.5, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
           </View>
           <View style={{ position: 'absolute', top: -4, left: 10, backgroundColor: docColors.secondary, border: '3px solid #000', paddingHorizontal: 16, paddingVertical: 4 }}>
              <Text style={{ fontFamily: 'Anton', fontSize: 14, color: '#FFF' }}>CASE FILE</Text>
           </View>
        </View>
      );
    }
    case 'explanation': {
        const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
        return (
          <View wrap={false} style={{ marginBottom: 30, position: 'relative', marginTop: 15, transform: 'rotate(-1deg)' }}>
             <View style={{ backgroundColor: docColors.highlight, borderTopWidth: 8, borderBottomWidth: 4, borderLeftWidth: 4, borderRightWidth: 4, borderColor: '#000', borderTopColor: docColors.primary, padding: 16 }}>
                <SuperheroRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Nunito', color: '#000', lineHeight: 1.5, textAlign: isBoxRtl ? 'right' : 'left', fontWeight: 700 }} docColors={docColors} />
             </View>
             {/* Pow Burst */}
             <View style={{ position: 'absolute', top: -30, right: -20, transform: 'rotate(15deg)' }}>
                <Svg width="60" height="60" viewBox="0 0 100 100">
                   <Path d="M 50 5 L 62 25 L 90 15 L 75 38 L 98 50 L 72 65 L 85 90 L 58 78 L 45 98 L 35 75 L 10 90 L 25 60 L 5 45 L 30 35 L 15 10 L 40 22 Z" fill={docColors.primary} stroke="#000" strokeWidth="4" strokeLinejoin="round" />
                   <Text x="15" y="60" style={{ fill: '#FFF', fontSize: 26, fontFamily: 'Anton' }}>POW!</Text>
                </Svg>
             </View>
          </View>
        );
      }
    case 'note': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
         <View wrap={false} style={{ marginBottom: 25, position: 'relative', transform: 'rotate(1deg)' }}>
            <View style={{ backgroundColor: '#FFF', border: '5px dashed #000', padding: 16 }}>
               <Text style={{ fontFamily: 'Anton', fontSize: 16, color: docColors.primary, marginBottom: 8, textTransform: 'uppercase' }}>ZAP! Take Note:</Text>
               <SuperheroRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Nunito', color: '#000', lineHeight: 1.5, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
            </View>
         </View>
      );
    }
    case 'warning': {
        const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
        return (
          <View wrap={false} style={{ marginBottom: 25, position: 'relative', transform: 'skewX(-8deg)' }}>
             {/* Danger box */}
             <View style={{ backgroundColor: '#000', padding: 8 }}>
                <View style={{ backgroundColor: docColors.primary, border: '3px solid #FFF', padding: 16 }}>
                  <View style={{ transform: 'skewX(8deg)' }}>
                    <Text style={{ fontFamily: 'Anton', fontSize: 18, color: '#FFF', marginBottom: 6, letterSpacing: 1 }}>DANGER!</Text>
                    <SuperheroRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Nunito', color: '#FFF', fontWeight: 700, lineHeight: 1.5, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
                  </View>
                </View>
             </View>
          </View>
        );
      }
    case 'tip': {
        const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
        return (
          <View wrap={false} style={{ marginBottom: 25, position: 'relative', paddingLeft: 30 }}>
             {/* Burst icon peeking out left */}
             <View style={{ position: 'absolute', top: 5, left: -20, transform: 'rotate(-25deg)', zIndex: 1 }}>
                <Svg width="60" height="60" viewBox="0 0 100 100">
                   <Path d="M 50 5 L 62 25 L 90 15 L 75 38 L 98 50 L 72 65 L 85 90 L 58 78 L 45 98 L 35 75 L 10 90 L 25 60 L 5 45 L 30 35 L 15 10 L 40 22 Z" fill={docColors.secondary} stroke="#000" strokeWidth="4" strokeLinejoin="round" />
                   <Text x="20" y="60" style={{ fill: '#FFF', fontSize: 24, fontFamily: 'Anton' }}>TIP!</Text>
                </Svg>
             </View>
             <View style={{ backgroundColor: '#E8F5E9', border: '3px solid #000', padding: 16, paddingLeft: 35, borderRadius: 10 }}>
                <SuperheroRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Nunito', color: '#000', fontWeight: 700, lineHeight: 1.5, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
             </View>
          </View>
        );
      }
    case 'high_yield': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
         <View wrap={false} style={{ marginBottom: 25, position: 'relative', transform: 'rotate(-2deg)' }}>
            <View style={{ position: 'absolute', top: 6, left: 6, right: -6, bottom: -6, backgroundColor: docColors.highlight }} />
            <View style={{ backgroundColor: '#FFF', border: '5px solid #000', padding: 16 }}>
               <View style={{ backgroundColor: '#000', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12, transform: 'rotate(2deg)' }}>
                 <Text style={{ fontFamily: 'Anton', fontSize: 14, color: docColors.highlight }}>CRITICAL HIT</Text>
               </View>
               <SuperheroRichText text={content} baseStyle={{ fontSize: 13, fontFamily: 'Nunito', color: '#000', fontWeight: 900, lineHeight: 1.5, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
            </View>
         </View>
      );
    }
    case 'list':
      const isOrdered = (block as any).style === 'ordered';
      return renderDynamicContainer(
        <View style={{ flexDirection: 'column' }}>
          {(block.items || []).map((item, i) => {
            const isItemRtl = isArabic(prepareInteractiveSyntax(item));
            return (
              <View wrap={false} key={i} style={{ flexDirection: isItemRtl ? 'row-reverse' : 'row', marginBottom: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 24, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 }}>
                  {isOrdered ? (
                    <View style={{ backgroundColor: docColors.primary, border: '2px solid #000', width: 20, height: 20, alignItems: 'center', justifyContent: 'center', transform: 'rotate(-5deg)' }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Anton', color: '#FFF' }}>{i + 1}</Text>
                    </View>
                  ) : (
                    <View style={{ width: 14, height: 14, backgroundColor: docColors.highlight, border: '3px solid #000', transform: 'rotate(45deg)' }} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: isItemRtl ? 0 : 8, marginRight: isItemRtl ? 8 : 0 }}>
                   <SuperheroRichText text={item} baseStyle={{ fontSize: 12, fontFamily: 'Nunito', lineHeight: 1.5, color: '#000', textAlign: isItemRtl ? 'right' : 'left' }} docColors={docColors} />
                </View>
              </View>
            );
          })}
        </View>,
        'classic'
      );
    case 'quote':
      const isQuoteRtl = isArabic(prepareInteractiveSyntax(content));
      return (
         <View wrap={false} style={{ marginVertical: 35, position: 'relative' }}>
            <View style={{ position: 'absolute', top: -15, left: -15, zIndex: 1 }}>
               <View style={{ backgroundColor: docColors.primary, border: '4px solid #000', borderRadius: 50, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0 }}>
                  <Text style={{ fontFamily: 'Anton', fontSize: 30, color: '#FFF', position: 'relative', top: 2 }}>"</Text>
               </View>
            </View>
            <View style={{ backgroundColor: sv.bg, border: '6px solid #000', borderBottomWidth: 12, padding: 25, paddingLeft: 35 }}>
               <SuperheroRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'Nunito', fontWeight: 900, color: '#000', textAlign: isQuoteRtl ? 'right' : 'left', lineHeight: 1.6 }} docColors={docColors} />
            </View>
         </View>
      );
    case 'code':
      return renderDynamicContainer(
        <Text style={{ fontFamily: 'Courier', fontSize: 11, color: '#FFF', lineHeight: 1.5 }}>
          {content}
        </Text>,
        'classic',
        { backgroundColor: '#222' }
      );
    case 'table':
        return renderDynamicContainer(
          <View style={{ flexDirection: 'column' }}>
            {block.columns && block.columns.length > 0 ? (
              <View style={{ flexDirection: 'row', backgroundColor: docColors.primary, padding: 12, borderBottomWidth: 4, borderBottomColor: '#000' }}>
                {block.columns.map((col, cIdx) => (
                  <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4 }}>
                     <SuperheroRichText text={col} baseStyle={{ fontSize: 11, fontFamily: 'Anton', color: '#FFF', textTransform: 'uppercase' }} docColors={docColors} />
                  </View>
                ))}
              </View>
            ) : []}
            <View style={{ flexDirection: 'column' }}>
              {(block.rows || []).map((row, rIdx) => (
                <View key={rIdx} style={{ flexDirection: 'row', backgroundColor: rIdx % 2 === 0 ? '#FFF' : '#F0F0F0', padding: 12, borderBottomWidth: rIdx === block.rows!.length - 1 ? 0 : 3, borderColor: '#000' }}>
                  {row.map((cell, cIdx) => (
                    <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4, borderRightWidth: cIdx === row.length - 1 ? 0 : 2, borderColor: '#CCC' }}>
                       <SuperheroRichText text={cell} baseStyle={{ fontSize: 11, color: '#000', fontFamily: 'Nunito', fontWeight: 700, lineHeight: 1.4 }} docColors={docColors} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>,
          'classic',
          { padding: 0 }
        );
    case 'image':
      if (!block.imageUrl) return <View />;
      return renderDynamicContainer(
        <View style={{ padding: 4, border: '4px solid #000' }}>
          <Image src={block.imageUrl} style={{ width: 480, height: 'auto', objectFit: 'cover' }} />
        </View>,
        'taped'
      );
    case 'page_break':
      return <View break />;
    default:
      return renderDynamicContainer(
        <SuperheroRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Nunito', color: '#000' }} docColors={docColors} />,
        assignedType
      );
  }
};

const SuperheroTableOfContents = ({ documents, docColors }: { documents: PdfDocument[], docColors: any }) => {
  const tocItems: { title: string; page: number }[] = [];
  let currentPage = 2; // Cover is 1, TOC is 2

  documents.forEach((doc, idx) => {
    tocItems.push({ title: doc.title || `Document ${idx + 1}`, page: currentPage });
    const blocksCount = doc.blocks.length;
    currentPage += Math.ceil(blocksCount / 5) || 1; 
  });

  return (
    <Page size="A4" style={{ backgroundColor: '#FFF', padding: 50, position: 'relative' }}>
      <SuperheroBackgroundGraphics colors={docColors} />
      <View style={{ marginBottom: 40, alignItems: 'center' }}>
        <View style={{ position: 'relative', transform: 'rotate(-2deg)' }}>
          <View style={{ position: 'absolute', top: 5, left: 5, right: -5, bottom: -5, backgroundColor: '#000' }} />
          <View style={{ backgroundColor: docColors.primary, border: '4px solid #000', paddingHorizontal: 30, paddingVertical: 10 }}>
            <Text style={{ fontSize: 40, fontFamily: 'Anton', color: '#FFF', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 }}>CONTENTS!</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {tocItems.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: (i % 2 === 0) ? '#FFF' : docColors.highlight, border: '3px solid #000', padding: 12, position: 'relative' }}>
             <View style={{ position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, backgroundColor: '#000', zIndex: -1 }} />
             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <View style={{ backgroundColor: docColors.secondary, paddingHorizontal: 8, paddingVertical: 2, border: '2px solid #000', marginRight: 12, transform: 'rotate(-5deg)' }}>
                 <Text style={{ fontSize: 14, fontFamily: 'Anton', color: '#FFF' }}>{i + 1}</Text>
               </View>
               <Text style={{ fontSize: 16, color: '#000', fontWeight: 900, fontFamily: 'Nunito', letterSpacing: 0.5 }}>{item.title}</Text>
             </View>
          </View>
        ))}
      </View>
    </Page>
  );
};

const SuperheroBackgroundGraphics = ({ colors, isCover = false }: { colors: any, isCover?: boolean }) => {
  // Center of A4 is roughly 297, 421
  const cx = 297.5;
  const cy = 421;
  const actionLines = [];
  
  if (isCover) {
    for(let i=0; i<360; i+=15) {
      actionLines.push(
        <Polygon 
          key={i} 
          points={`${cx},${cy} ${cx - 50},${cy - 600} ${cx + 50},${cy - 600}`} 
          fill={colors.secondary} 
          opacity={0.2} 
          transform={`rotate(${i}, ${cx}, ${cy})`}
        />
      );
    }
  }

  return (
    <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
      <Defs>
      </Defs>

      {/* Base Background */}
      <Rect x="0" y="0" width="595" height="842" fill={isCover ? colors.highlight : '#FFFFFF'} />
      
      {/* Action Lines for Cover */}
      {isCover && (
         <G>{actionLines}</G>
      )}

      {/* Comic Panel Grid Background (Subtle) */}
      {!isCover && (
        <G opacity="0.1" stroke="#000" strokeWidth="4">
          <Line x1="20" y1="280" x2="575" y2="270" />
          <Line x1="20" y1="560" x2="575" y2="580" />
          <Line x1="300" y1="20" x2="280" y2="822" />
        </G>
      )}

      {/* Comic Border Frame */}
      <Rect x="15" y="15" width="565" height="812" fill="none" stroke="#000" strokeWidth="8" />
      <Rect x="20" y="20" width="555" height="802" fill="none" stroke={colors.primary} strokeWidth="2" />
      
      {/* Page Action Accents (Corners) */}
      <Polygon points="15,15 15,80 80,15" fill={colors.secondary} stroke="#000" strokeWidth="3" />
      <Polygon points="580,827 580,762 515,827" fill={colors.primary} stroke="#000" strokeWidth="3" />
      
      {/* City Skyline for cover */}
      {isCover && (
        <G>
           <CitySkyline color={colors.secondary} />
           <G transform="translate(-15, 20)">
              <CitySkyline color="#000000" />
           </G>
        </G>
      )}
    </Svg>
  );
};

export const ReactPdfOutputSuperhero = ({ 
  documents, 
  themeColor, 
  includeToc = true,
  includeCover = true,
  colorSequence = ['red'],
  isExam = false
}: { 
  documents: PdfDocument[]; 
  themeColor: string; 
  includeToc?: boolean;
  includeCover?: boolean;
  colorSequence?: string[];
  isExam?: boolean;
}) => {
  const getColorsForDoc = (groupName?: string) => {
    // Comic Primary colors mapping
    const basicColors: Record<string, { primary: string, secondary: string, highlight: string }> = {
      red: { primary: "#E50914", secondary: "#0052CC", highlight: "#FFEB3B" },
      blue: { primary: "#0052CC", secondary: "#E50914", highlight: "#FFEB3B" },
      yellow: { primary: "#FFEB3B", secondary: "#E50914", highlight: "#0052CC" },
      green: { primary: "#4CAF50", secondary: "#9C27B0", highlight: "#FFEB3B" },
      purple: { primary: "#9C27B0", secondary: "#4CAF50", highlight: "#FFEB3B" },
      orange: { primary: "#FF9800", secondary: "#0052CC", highlight: "#4CAF50" },
    };

    let colorName = themeColor || 'red';
    if (colorName.startsWith('custom-')) {
       return { primary: "#E50914", secondary: "#0052CC", highlight: "#FFEB3B" };
    }

    const baseColorName = colorName.split('-')[0];
    return basicColors[baseColorName] || basicColors['red'];
  };

  const docColors = getColorsForDoc('default');

  return (
    <Document>
      {includeCover && (
        <Page size="A4" style={{ backgroundColor: docColors.highlight, position: 'relative', overflow: 'hidden' }}>
          <SuperheroBackgroundGraphics colors={docColors} isCover={true} />
          
          {/* Halftone patterned top banner */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: docColors.primary, borderBottom: '6px solid #000' }} />
          
          <View style={{ flex: 1, padding: 30, paddingTop: 60, position: 'relative' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              {/* Comic Issue info box */}
              <View style={{ backgroundColor: '#FFF', border: '3px solid #000', padding: 8, width: 80, alignItems: 'center' }}>
                 <Text style={{ fontSize: 10, fontFamily: 'Anton', color: docColors.primary }}>APPROVED</Text>
                 <Text style={{ fontSize: 8, fontFamily: 'Nunito', fontWeight: 900, color: '#000' }}>BY THE</Text>
                 <Text style={{ fontSize: 12, fontFamily: 'Anton', color: docColors.secondary }}>ARCANE</Text>
                 <Text style={{ fontSize: 8, fontFamily: 'Nunito', fontWeight: 900, color: '#000' }}>AUTHORITY</Text>
              </View>
              <View style={{ backgroundColor: '#FFF', border: '3px solid #000', padding: 8, width: 80, alignItems: 'center', justifyContent: 'center' }}>
                 <Text style={{ fontSize: 16, fontFamily: 'Anton', color: '#000' }}>ISSUE #1</Text>
                 <Text style={{ fontSize: 10, fontFamily: 'Nunito', fontWeight: 900, color: docColors.primary, marginTop: 4 }}>VOL. 1</Text>
              </View>
            </View>

            {/* Title Banner */}
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <View style={{ transform: 'rotate(-4deg)', position: 'relative' }}>
                 <View style={{ position: 'absolute', top: 8, left: 8, right: -8, bottom: -8, backgroundColor: docColors.secondary }} />
                 <View style={{ position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, backgroundColor: '#000' }} />
                 <View style={{ backgroundColor: '#FFF', padding: 25, border: '6px solid #000', minWidth: 400, alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, color: docColors.primary, fontFamily: 'Anton', textTransform: 'uppercase', marginBottom: -10 }}>{isExam ? 'The Legendary' : 'Presenting'} </Text>
                    <Text style={{ fontSize: 50, fontFamily: 'Anton', color: '#000', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.1 }}>
                      {documents[0]?.title || 'UNTITLED'}
                    </Text>
                 </View>
              </View>
            </View>
            
            {/* Some character or big visual element */}
            <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 60, zIndex: 10 }}>
               {/* Pow box replacing the old center text */}
               <View style={{ position: 'relative', marginBottom: 20 }}>
                 <Svg width="250" height="200" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
                    {/* Dynamic pop star/burst */}
                    <Path d="M 50 5 L 62 25 L 90 15 L 75 38 L 98 50 L 72 65 L 85 90 L 58 78 L 45 98 L 35 75 L 10 90 L 25 60 L 5 45 L 30 35 L 15 10 L 40 22 Z" fill={docColors.primary} stroke="#000" strokeWidth="3" strokeLinejoin="round" />
                    <Text x="12" y="65" style={{ fill: '#FFF', fontSize: 36, fontFamily: 'Anton', transform: 'rotate(-10deg)' }}>ACTION!</Text>
                 </Svg>
               </View>

               <View style={{ backgroundColor: docColors.highlight, border: '4px solid #000', paddingHorizontal: 20, paddingVertical: 10, alignSelf: 'flex-start', transform: 'rotate(2deg)' }}>
                  <Text style={{ fontSize: 18, fontFamily: 'Nunito', fontWeight: 900, color: '#000' }}>FEATURING...</Text>
               </View>
               <View style={{ backgroundColor: '#FFF', border: '4px solid #000', paddingHorizontal: 20, paddingVertical: 10, alignSelf: 'flex-start', marginLeft: 20, transform: 'rotate(-1deg)', marginTop: -5 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Anton', color: docColors.secondary }}>INCREDIBLE KNOWLEDGE!</Text>
               </View>
            </View>

            {/* Barcode bottom corner */}
            <View style={{ position: 'absolute', bottom: 30, right: 30, backgroundColor: '#FFF', border: '3px solid #000', padding: 5, width: 80, height: 50, flexDirection: 'row', justifyContent: 'space-between' }}>
               <View style={{ width: 4, height: '100%', backgroundColor: '#000' }} />
               <View style={{ width: 2, height: '100%', backgroundColor: '#000' }} />
               <View style={{ width: 6, height: '100%', backgroundColor: '#000' }} />
               <View style={{ width: 3, height: '100%', backgroundColor: '#000' }} />
               <View style={{ width: 1, height: '100%', backgroundColor: '#000' }} />
               <View style={{ width: 5, height: '100%', backgroundColor: '#000' }} />
               <View style={{ width: 2, height: '100%', backgroundColor: '#000' }} />
               <View style={{ width: 8, height: '100%', backgroundColor: '#000' }} />
               <View style={{ width: 2, height: '100%', backgroundColor: '#000' }} />
               <View style={{ width: 4, height: '100%', backgroundColor: '#000' }} />
            </View>
          </View>
        </Page>
      )}

      {includeToc && documents.length > 1 && (
        <SuperheroTableOfContents documents={documents} docColors={docColors} />
      )}

      {documents.map((doc, docIdx) => {
        const dColors = getColorsForDoc(doc.group);
        return (
          <Page key={docIdx} size="A4" style={{ backgroundColor: '#FFF', padding: 50, paddingBottom: 60, position: 'relative' }}>
            <SuperheroBackgroundGraphics colors={dColors} />

            {/* Document Title Header */}
            {doc.title && (!includeCover || docIdx > 0) && (
              <View style={{ marginBottom: 30, marginTop: 10, alignSelf: 'flex-start', transform: 'rotate(-2deg)' }}>
                 <View style={{ position: 'relative' }}>
                   <View style={{ position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, backgroundColor: '#000' }} />
                   <View style={{ backgroundColor: dColors.primary, border: '4px solid #000', paddingVertical: 10, paddingHorizontal: 20 }}>
                     <Text style={{ fontSize: 32, fontFamily: 'Anton', fontWeight: 400, color: '#FFF', textTransform: 'uppercase' }}>
                       {doc.title}
                     </Text>
                   </View>
                 </View>
              </View>
            )}

            {doc.blocks.map((block, idx) => (
              <SuperheroBlockRenderer key={idx} block={block} docColors={dColors} index={idx} />
            ))}

            {/* Page Footer */}
            <View fixed style={{ position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' }}>
               <View style={{ backgroundColor: '#000', paddingHorizontal: 16, paddingVertical: 6, transform: 'rotate(2deg)' }}>
                  <Text render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`} style={{ fontSize: 12, color: '#FFF', fontFamily: 'Anton' }} />
               </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

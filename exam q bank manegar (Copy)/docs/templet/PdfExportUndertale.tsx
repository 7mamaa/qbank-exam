import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Circle, Font, Rect } from '@react-pdf/renderer';

// Register pixel fonts
Font.register({
  family: 'DotGothic16',
  src: 'https://fonts.gstatic.com/s/dotgothic16/v21/v6-QGYjBJFKgyw5nSoDAGE7L.ttf'
});

Font.register({
  family: 'PressStart2P',
  src: 'https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK0nS.ttf'
});

// Cairo for Arabic (keep it for compatibility)
Font.register({
  family: 'Cairo',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf', fontWeight: 700 }
  ]
});

const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);
const getFontFamily = (text: string, isHead = false) => {
  if (isArabic(text)) return 'Cairo';
  return isHead ? 'PressStart2P' : 'DotGothic16';
};

const UNDERTALE_COLORS = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  yellow: '#FFFF00',
  green: '#00FF00',
  blue: '#0000FF',
  orange: '#FFA500',
};

const prepareInteractiveSyntax = (text: string) => {
  if (!text) return "";
  let t = String(text);
  t = t.replace(/<term\s+title=(?:'|")([^'"]+)(?:'|")[^>]*>([\s\S]*?)<\/term>/g, "$2");
  t = t.replace(/<term[^>]*>([\s\S]*?)<\/term>/g, "$1");
  t = t.replace(/\{\{(.*?)\|(.*?)\}\}/g, "$1 ($2)");
  t = t.replace(/!!(.*?)\|(.*?)!!/g, "$1 ($2)");
  t = t.replace(/>>(.*?)\|(.*?)<</g, "$1: $2");
  t = t.replace(/\(\((.*?)\|(.*?)\)\)/g, "$2");
  t = t.replace(/\?\?(.*?)\|(.*?)\?\?/g, "$1");
  t = t.replace(/%%(.*?)\|(.*?)%%/g, "$1 ($2)");
  t = t.replace(/~~(.*?)\|(.*?)~~/g, "$2");
  t = t.replace(/\^\^(.*?)\|(.*?)\^\^/g, "$1 [$2]");
  t = t.replace(/\*\*([^*|]+)\|([^*|]+)\*\*/g, "$1 ($2)");
  t = t.replace(/\[\[Match\|(.*?)\]\]/g, "__________");
  t = t.replace(/\(\(\(\w+\|(.*?)\)\)\)/g, "$1");
  // Clean up problematic characters
  t = t.replace(/[º¶]/g, "");
  return t;
};

const UndertaleRichText = ({ text, baseStyle }: { text: string; baseStyle: any }): any => {
  if (!text) return <Text style={baseStyle}>{" "}</Text>;
  const processed = prepareInteractiveSyntax(text);
  const parts = processed.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|==.*?==|@@[^@]+@@)/g);

  if (parts.length === 1 && !processed.match(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|==.*?==|@@[^@]+@@)/)) {
    return <Text style={{ ...baseStyle, fontFamily: getFontFamily(processed) }}>{processed}</Text>;
  }

  return (
    <Text style={baseStyle}>
      {parts.filter(Boolean).map((part, i) => {
        let style: any = {
          ...baseStyle,
          fontFamily: getFontFamily(part)
        };

        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
          const content = part.slice(2, -2);
          return <UndertaleRichText key={i} text={content} baseStyle={{ ...style, color: UNDERTALE_COLORS.yellow }} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <UndertaleRichText key={i} text={content} baseStyle={{ ...style, color: UNDERTALE_COLORS.red }} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          return <UndertaleRichText key={i} text={content} baseStyle={{ ...style, color: UNDERTALE_COLORS.green }} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = UNDERTALE_COLORS.blue;
          return <Text key={i} style={style}> {content} </Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.color = UNDERTALE_COLORS.orange;
          return <Text key={i} style={style}>{`[* ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

const UndertaleBackground = () => (
  <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: UNDERTALE_COLORS.black }}>
    <Svg width="595" height="842" viewBox="0 0 595 842">
      {/*scanlines effect */}
      {Array.from({ length: 210 }).map((_, i) => (
        <Rect key={`scan-${i}`} x={0} y={i * 4} width={595} height={1} fill={UNDERTALE_COLORS.white} opacity={0.03} />
      ))}

      {/* Deterministic Star field */}
      {Array.from({ length: 80 }).map((_, i) => {
        const x = (i * 137.5 + 42) % 595;
        const y = (i * 224.7 + 91) % 842;
        const size = (i % 3) + 1;
        const opacity = 0.1 + (i % 6) * 0.08;
        return (
          <Rect
            key={`star-${i}`}
            x={x}
            y={y}
            width={size}
            height={size}
            fill={UNDERTALE_COLORS.white}
            opacity={opacity}
          />
        );
      })}

      {/* Abstract Pixel Clusters (Corners and Sides) */}
      {[
        { x: 50, y: 50 }, { x: 500, y: 150 }, { x: 100, y: 700 }, { x: 450, y: 800 },
        { x: 300, y: 40 }, { x: 20, y: 400 }, { x: 560, y: 500 }
      ].map((pos, idx) => (
        <View key={`cluster-${idx}`}>
          <Rect x={pos.x} y={pos.y} width={8} height={8} fill={UNDERTALE_COLORS.white} opacity={0.15} />
          <Rect x={pos.x + 8} y={pos.y + 8} width={4} height={4} fill={UNDERTALE_COLORS.white} opacity={0.1} />
          <Rect x={pos.x - 4} y={pos.y + 12} width={4} height={4} fill={UNDERTALE_COLORS.white} opacity={0.05} />
        </View>
      ))}
      
      {/* Corner Brackets - Thickened */}
      <Path d="M20 20 H80 V28 H28 V80 H20 Z" fill={UNDERTALE_COLORS.white} opacity={0.4} />
      <Path d="M515 20 H575 V80 H567 V28 H515 Z" fill={UNDERTALE_COLORS.white} opacity={0.4} />
      <Path d="M20 762 V822 H80 V814 H28 V762 Z" fill={UNDERTALE_COLORS.white} opacity={0.4} />
      <Path d="M575 762 V822 H515 V814 H567 V762 Z" fill={UNDERTALE_COLORS.white} opacity={0.4} />

      {/* Side Decorative Bars with Dash Pattern */}
      <Rect x={12} y={100} width={4} height={642} fill={UNDERTALE_COLORS.white} opacity={0.08} />
      <Rect x={579} y={100} width={4} height={642} fill={UNDERTALE_COLORS.white} opacity={0.08} />
      {Array.from({ length: 20 }).map((_, i) => (
        <Rect key={`dash-${i}`} x={12} y={120 + i * 32} width={8} height={2} fill={UNDERTALE_COLORS.white} opacity={0.2} />
      ))}
    </Svg>
  </View>
);

// Icon helpers
const UndertaleHeart = ({ color = UNDERTALE_COLORS.red }: { color?: string }) => (
  <Svg width="12" height="12" viewBox="0 0 10 10">
    <Path d="M2,1 H4 V2 H6 V1 H8 V2 H9 V5 H8 V6 H7 V7 H6 V8 H4 V7 H3 V6 H2 V5 H1 V2 Z" fill={color} />
  </Svg>
);

const SaveStar = () => (
  <Svg width="16" height="16" viewBox="0 0 16 16">
    <Path d="M7,1 H9 V3 H13 V5 H15 V7 H13 V9 H11 V11 H9 V13 H7 V11 H5 V9 H3 V7 H1 V5 H3 V3 H7 Z" fill={UNDERTALE_COLORS.yellow} />
  </Svg>
);

const DialogueBox = ({ children, style, borderColor = UNDERTALE_COLORS.white }: { children: any, style?: any, borderColor?: string }) => (
  <View style={{ marginBottom: 20, padding: 4, ...style }}>
    {/* Inner Box with border */}
    <View style={{
      borderWidth: 4,
      borderColor: borderColor,
      padding: 20,
      backgroundColor: UNDERTALE_COLORS.black,
      position: 'relative'
    }}>
      {/* Internal Corner Accents */}
      <View style={{ position: 'absolute', top: 4, left: 4 }}>
        <Rect width={4} height={4} fill={borderColor} opacity={0.5} />
      </View>
      <View style={{ position: 'absolute', top: 4, right: 4 }}>
        <Rect width={4} height={4} fill={borderColor} opacity={0.5} />
      </View>
      <View style={{ position: 'absolute', bottom: 4, left: 4 }}>
        <Rect width={4} height={4} fill={borderColor} opacity={0.5} />
      </View>
      <View style={{ position: 'absolute', bottom: 4, right: 4 }}>
        <Rect width={4} height={4} fill={borderColor} opacity={0.5} />
      </View>
      {children}
    </View>
  </View>
);

export const ReactPdfOutputUndertale = ({
  documents,
  includeToc = true,
  includeCover = true,
  isExam = false
}: {
  documents: PdfDocument[];
  includeToc?: boolean;
  includeCover?: boolean;
  isExam?: boolean;
}) => {
  const groupsOrder = Array.from(new Set(documents.map(d => d.group || "Ungrouped")));

  return (
    <Document title="Undertale Document" author="System">
      {includeCover ? (
        <Page size="A4" style={{ position: 'relative', backgroundColor: UNDERTALE_COLORS.black }}>
          <UndertaleBackground />
          
          {/* Massive Decorative Pixel Frames */}
          <View style={{ position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderWidth: 8, borderColor: UNDERTALE_COLORS.white }} />
          <View style={{ position: 'absolute', top: 25, left: 25, right: 25, bottom: 25, borderWidth: 2, borderColor: UNDERTALE_COLORS.white, opacity: 0.3 }} />
          
          {/* Floating Pixel Debris */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
             <Svg width="595" height="842" viewBox="0 0 595 842">
                {[
                  { x: 100, y: 150, s: 12, c: UNDERTALE_COLORS.red },
                  { x: 450, y: 120, s: 8, c: UNDERTALE_COLORS.yellow },
                  { x: 50, y: 400, s: 10, c: UNDERTALE_COLORS.blue },
                  { x: 520, y: 450, s: 14, c: UNDERTALE_COLORS.green },
                  { x: 90, y: 700, s: 6, b: true },
                  { x: 480, y: 750, s: 10, b: true },
                  { x: 300, y: 40, s: 8, c: UNDERTALE_COLORS.orange }
                ].map((p, i) => (
                  <Rect key={`debris-${i}`} x={p.x} y={p.y} width={p.s} height={p.s} fill={p.c || UNDERTALE_COLORS.white} opacity={0.2} />
                ))}
             </Svg>
          </View>

          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 60, justifyContent: 'center', alignItems: 'center' }}>
            
            {/* The Soul (Centerpiece) */}
            <View style={{ marginBottom: 60, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
               <View style={{ position: 'absolute', width: 120, height: 120, borderWidth: 2, borderColor: 'white', opacity: 0.1, transform: 'rotate(45deg)' }} />
               <View style={{ position: 'absolute', width: 90, height: 90, borderWidth: 1, borderColor: 'white', opacity: 0.2, transform: 'rotate(-15deg)' }} />
               <View style={{ transform: 'scale(5)' }}>
                  <UndertaleHeart color={UNDERTALE_COLORS.red} />
               </View>
            </View>

            {/* Title Section (The Great Notice) */}
            <View style={{ width: '100%', alignItems: 'center' }}>
               <View style={{ height: 6, width: '100%', backgroundColor: UNDERTALE_COLORS.white, marginBottom: 8 }} />
               <View style={{ height: 2, width: '100%', backgroundColor: UNDERTALE_COLORS.white, marginBottom: 40, opacity: 0.5 }} />
               
               <Text style={{
                  fontSize: 42,
                  color: UNDERTALE_COLORS.white,
                  fontFamily: 'PressStart2P',
                  textAlign: 'center',
                  marginBottom: 30,
                  lineHeight: 1.3
                }}>
                  {groupsOrder[0] && groupsOrder[0] !== 'Ungrouped' ? groupsOrder[0] : (documents[0]?.title || 'MY ADVENTURE')}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 30, marginBottom: 40 }}>
                   <View style={{ height: 2, width: 80, backgroundColor: UNDERTALE_COLORS.white }} />
                   <SaveStar />
                   <View style={{ height: 2, width: 80, backgroundColor: UNDERTALE_COLORS.white }} />
                </View>

                {/* Status Bar style description */}
                <View style={{ 
                  backgroundColor: '#222', 
                  borderWidth: 3, 
                  borderColor: UNDERTALE_COLORS.white,
                  padding: 15,
                  width: '90%',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                   <Text style={{
                      fontSize: 16,
                      color: UNDERTALE_COLORS.yellow,
                      fontFamily: 'PressStart2P',
                      marginRight: 20
                   }}>LV 99</Text>
                   <Text style={{
                      fontSize: 16,
                      color: UNDERTALE_COLORS.white,
                      fontFamily: 'DotGothic16',
                      letterSpacing: 2
                   }}>
                      {isExam ? '* ENCOUNTER START' : '* JOURNEY BEGINS'}
                   </Text>
                </View>

                <Text style={{
                  marginTop: 30,
                  fontSize: 14,
                  color: UNDERTALE_COLORS.red,
                  fontFamily: 'DotGothic16',
                  textAlign: 'center'
                }}>
                  {isExam ? '* It looks like you have no choice.' : '* Staying determined is your only path.'}
                </Text>

                <View style={{ height: 2, width: '100%', backgroundColor: UNDERTALE_COLORS.white, marginTop: 40, opacity: 0.5 }} />
                <View style={{ height: 6, width: '100%', backgroundColor: UNDERTALE_COLORS.white, marginTop: 8 }} />
            </View>

            {/* Visual Action Buttons footer */}
            <View style={{ marginTop: 60, flexDirection: 'row', gap: 20 }}>
               {['FIGHT', 'ACT', 'ITEM', 'MERCY'].map((label, i) => (
                 <View key={label} style={{ 
                   borderWidth: 2, 
                   borderColor: i === 0 ? UNDERTALE_COLORS.orange : UNDERTALE_COLORS.white,
                   padding: 6,
                   opacity: 0.6
                 }}>
                    <Text style={{ fontSize: 10, color: i === 0 ? UNDERTALE_COLORS.orange : UNDERTALE_COLORS.white, fontFamily: 'PressStart2P' }}>
                      {`[ ${label} ]`}
                    </Text>
                 </View>
               ))}
            </View>
          </View>
        </Page>
      ) : []}

      {documents.map((doc, dIdx) => (
        <Page key={dIdx} size="A4" style={{ padding: 40, paddingBottom: 60, position: 'relative', backgroundColor: UNDERTALE_COLORS.black }}>
          <UndertaleBackground />
          
          <View style={{ marginBottom: 30 }}>
             <View style={{ borderBottomWidth: 4, borderBottomColor: UNDERTALE_COLORS.white, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: isArabic(doc.title) ? 'flex-end' : 'flex-start' }}>
               {!isArabic(doc.title) ? <View style={{ marginRight: 15 }}><UndertaleHeart /></View> : []}
               <Text style={{
                 fontSize: 24,
                 color: UNDERTALE_COLORS.white,
                 fontFamily: getFontFamily(doc.title, true),
                 textAlign: isArabic(doc.title) ? 'right' : 'left'
               }}>
                 {doc.title}
               </Text>
               {isArabic(doc.title) ? <View style={{ marginLeft: 15 }}><UndertaleHeart /></View> : []}
             </View>
          </View>

          {doc.blocks.map((block, bIdx) => {
            const content = block.content || '';
            const isBlockRtl = isArabic(prepareInteractiveSyntax(content));

            switch (block.type) {
              case 'heading':
              case 'subheading':
                return (
                  <View key={bIdx} style={{ marginTop: 25, marginBottom: 15, flexDirection: isBlockRtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
                    <View style={{ marginRight: isBlockRtl ? 0 : 10, marginLeft: isBlockRtl ? 10 : 0 }}>
                      <UndertaleHeart color={block.type === 'heading' ? UNDERTALE_COLORS.red : UNDERTALE_COLORS.yellow} />
                    </View>
                    <UndertaleRichText 
                      text={content} 
                      baseStyle={{
                        fontSize: block.type === 'heading' ? 18 : 14,
                        color: block.type === 'heading' ? UNDERTALE_COLORS.white : UNDERTALE_COLORS.yellow,
                        fontFamily: getFontFamily(content, true),
                        textAlign: isBlockRtl ? 'right' : 'left',
                      }} 
                    />
                  </View>
                );

              case 'subtitle':
                return (
                  <View key={bIdx} style={{ marginTop: 10, marginBottom: 8, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: UNDERTALE_COLORS.green }}>
                    <UndertaleRichText 
                      text={content} 
                      baseStyle={{ 
                        fontSize: 14, 
                        color: UNDERTALE_COLORS.green, 
                        fontFamily: 'DotGothic16',
                        textAlign: isBlockRtl ? 'right' : 'left' 
                      }} 
                    />
                  </View>
                );

              case 'image':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, alignItems: 'center' }}>
                    <View style={{
                      padding: 10,
                      backgroundColor: UNDERTALE_COLORS.black,
                      borderWidth: 4,
                      borderColor: UNDERTALE_COLORS.white,
                    }}>
                      <Image src={block.content} style={{ width: '100%', maxHeight: 300, objectFit: 'contain' }} />
                      <View style={{ borderTopWidth: 2, borderTopColor: UNDERTALE_COLORS.white, marginTop: 10, paddingTop: 10 }}>
                        <Text style={{ textAlign: 'center', fontFamily: 'DotGothic16', fontSize: 12, color: UNDERTALE_COLORS.white }}>
                          {`* (It's ${block.imageCaption || 'a strange sight.'})`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );

              case 'dialogue':
                return (
                  <DialogueBox key={bIdx}>
                    <UndertaleRichText text={`* ${content}`} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.white, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                  </DialogueBox>
                );

              case 'summary':
              case 'high_yield':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, padding: 20, backgroundColor: UNDERTALE_COLORS.black, borderWidth: 4, borderColor: UNDERTALE_COLORS.yellow }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, justifyContent: isBlockRtl ? 'flex-end' : 'flex-start' }}>
                      <SaveStar />
                      <Text style={{ fontSize: 14, color: UNDERTALE_COLORS.yellow, fontFamily: 'PressStart2P', marginLeft: 15, marginRight: 15 }}>
                        {block.type === 'summary' ? 'FILE SAVED' : 'LEVEL UP!'}
                      </Text>
                      <SaveStar />
                    </View>
                    <View style={{ borderTopWidth: 2, borderTopColor: UNDERTALE_COLORS.yellow, paddingTop: 15 }}>
                      <UndertaleRichText text={content} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.white, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                    </View>
                  </View>
                );

              case 'quote':
                return (
                  <DialogueBox key={bIdx} borderColor="#888888">
                    <UndertaleRichText text={content} baseStyle={{ fontSize: 14, color: '#CCCCCC', fontStyle: 'italic', textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                    <View style={{ position: 'absolute', bottom: -10, right: 20, backgroundColor: UNDERTALE_COLORS.black, paddingHorizontal: 10 }}>
                      <Text style={{ fontSize: 10, color: '#888888', fontFamily: 'DotGothic16' }}>- Echo Flower</Text>
                    </View>
                  </DialogueBox>
                );

              case 'vocabulary':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, padding: 16, backgroundColor: '#0A0A0A', borderLeftWidth: 4, borderLeftColor: UNDERTALE_COLORS.yellow, borderRightWidth: 4, borderRightColor: UNDERTALE_COLORS.white }}>
                     <View style={{ marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', paddingBottom: 5, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ marginRight: 10 }}><UndertaleHeart color={UNDERTALE_COLORS.yellow} /></View>
                        <UndertaleRichText text={`${block.term || 'TERM'}`} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.yellow, fontFamily: 'PressStart2P', textAlign: isBlockRtl ? 'right' : 'left' }} />
                     </View>
                     <View style={{ paddingLeft: 20 }}>
                        <UndertaleRichText text={block.definition || content} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.white, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                     </View>
                  </View>
                );

              case 'flashcard':
                return (
                  <View key={bIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                    <View style={{ flex: 1, marginRight: 10, borderWidth: 4, borderColor: UNDERTALE_COLORS.white, padding: 15, backgroundColor: UNDERTALE_COLORS.black }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: UNDERTALE_COLORS.orange, paddingBottom: 5 }}>
                        <Rect width="12" height="12" fill={UNDERTALE_COLORS.orange} />
                        <Text style={{ fontSize: 10, color: UNDERTALE_COLORS.orange, fontFamily: 'PressStart2P', marginLeft: 10 }}>FIGHT</Text>
                      </View>
                      <UndertaleRichText text={block.front || block.term || content || ''} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.white, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10, borderWidth: 4, borderColor: UNDERTALE_COLORS.white, padding: 15, backgroundColor: UNDERTALE_COLORS.black }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: UNDERTALE_COLORS.yellow, paddingBottom: 5 }}>
                        <Rect width="12" height="12" fill={UNDERTALE_COLORS.yellow} />
                        <Text style={{ fontSize: 10, color: UNDERTALE_COLORS.yellow, fontFamily: 'PressStart2P', marginLeft: 10 }}>MERCY</Text>
                      </View>
                      <UndertaleRichText text={block.back || block.definition || ''} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.white, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                    </View>
                  </View>
                );

              case 'list':
                return (
                  <View key={bIdx} style={{ marginVertical: 10, paddingLeft: isBlockRtl ? 0 : 10, paddingRight: isBlockRtl ? 10 : 0 }}>
                    {(block.items || content.split('\n')).map((item, i) => (
                      <View key={i} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', marginBottom: 8, alignItems: 'center' }}>
                        <View style={{ marginRight: isBlockRtl ? 0 : 12, marginLeft: isBlockRtl ? 12 : 0 }}>
                          <UndertaleHeart color={i % 2 === 0 ? UNDERTALE_COLORS.red : UNDERTALE_COLORS.blue} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <UndertaleRichText text={item} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.white, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                        </View>
                      </View>
                    ))}
                  </View>
                );

              case 'step':
                return (
                  <View key={bIdx} style={{ marginVertical: 20 }}>
                    {(block.items || content.split('\n')).map((item, i) => (
                      <View key={i} style={{ marginBottom: 15, flexDirection: isBlockRtl ? 'row-reverse' : 'row' }}>
                        <View style={{ backgroundColor: UNDERTALE_COLORS.white, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: isBlockRtl ? 0 : 15, marginLeft: isBlockRtl ? 15 : 0 }}>
                           <Text style={{ color: UNDERTALE_COLORS.black, fontSize: 14, fontFamily: 'PressStart2P' }}>{i+1}</Text>
                        </View>
                        <View style={{ flex: 1, borderBottomWidth: 2, borderBottomColor: '#222222', paddingBottom: 10 }}>
                           <UndertaleRichText text={item} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.white, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                        </View>
                      </View>
                    ))}
                  </View>
                );

              case 'code':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, backgroundColor: '#050505', padding: 20, borderWidth: 2, borderColor: UNDERTALE_COLORS.green, position: 'relative' }}>
                    <Text style={{ position: 'absolute', top: -10, left: 20, backgroundColor: UNDERTALE_COLORS.black, color: UNDERTALE_COLORS.green, fontSize: 8, fontFamily: 'PressStart2P', paddingHorizontal: 5 }}>[ SYSTEM_LOG ]</Text>
                    <Text style={{ color: UNDERTALE_COLORS.green, fontFamily: 'PressStart2P', fontSize: 10, lineHeight: 2 }}>
                      {content}
                    </Text>
                  </View>
                );

              case 'horizontal_rule':
                return (
                  <View key={bIdx} style={{ marginVertical: 25, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                    <View style={{ flex: 1, height: 4, backgroundColor: UNDERTALE_COLORS.white }} />
                    <View style={{ marginHorizontal: 20 }}><UndertaleHeart /></View>
                    <View style={{ flex: 1, height: 4, backgroundColor: UNDERTALE_COLORS.white }} />
                  </View>
                );

              case 'table':
                try {
                  const parseRow = (line: string) => line.split('|').filter(cell => cell.trim().length > 0).map(cell => cell.trim());
                  const lines = content.split('\n').filter(l => l.trim().startsWith('|'));
                  if (lines.length >= 3) {
                    const header = parseRow(lines[0]);
                    const rows = lines.slice(2).map(parseRow);
                    const isBlockRtl = isArabic(prepareInteractiveSyntax(lines[0]));
                    return (
                      <View key={bIdx} style={{ marginVertical: 15, borderWidth: 4, borderColor: UNDERTALE_COLORS.white }}>
                        <View style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', borderBottomWidth: 4, borderBottomColor: UNDERTALE_COLORS.white, backgroundColor: '#111111' }}>
                          {header.map((v, i) => (
                            <View key={i} style={{ flex: 1, padding: 12, borderRightWidth: i === header.length - 1 ? 0 : 2, borderRightColor: UNDERTALE_COLORS.white }}>
                              <UndertaleRichText text={v} baseStyle={{ fontSize: 12, color: UNDERTALE_COLORS.yellow, fontWeight: 'bold', textAlign: 'center' }} />
                            </View>
                          ))}
                        </View>
                        {rows.map((row, rI) => (
                          <View key={rI} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', borderBottomWidth: rI === rows.length - 1 ? 0 : 2, borderBottomColor: UNDERTALE_COLORS.white }}>
                            {row.map((val, cI) => (
                              <View key={cI} style={{ flex: 1, padding: 12, borderRightWidth: cI === row.length - 1 ? 0 : 2, borderRightColor: UNDERTALE_COLORS.white }}>
                                 <UndertaleRichText text={val} baseStyle={{ fontSize: 12, color: UNDERTALE_COLORS.white, textAlign: 'center' }} />
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    );
                  }
                } catch (e) {
                  // fallback
                }
                return (
                  <View key={bIdx} style={{ marginBottom: 12 }}>
                     <UndertaleRichText text={content} baseStyle={{ fontSize: 14, fontFamily: 'DotGothic16', color: UNDERTALE_COLORS.white, lineHeight: 1.6, textAlign: isBlockRtl ? 'right' : 'left' }} />
                  </View>
                );

              case 'example':
              case 'explanation':
              case 'note':
              case 'warning':
              case 'tip':
              case 'clinical_correlation':
                let label = 'CHECK';
                let labelColor = UNDERTALE_COLORS.white;
                let btnLabel = '[ CHECK ]';
                
                if (block.type === 'example') { label = 'ACT'; labelColor = UNDERTALE_COLORS.green; btnLabel = '[ ACT ]'; }
                else if (block.type === 'explanation') { label = 'INFO'; labelColor = UNDERTALE_COLORS.white; btnLabel = '[ INFO ]'; }
                else if (block.type === 'note' || block.type === 'clinical_correlation') { label = 'ITEM'; labelColor = UNDERTALE_COLORS.yellow; btnLabel = '[ ITEM ]'; }
                else if (block.type === 'warning') { label = 'DANGER'; labelColor = UNDERTALE_COLORS.red; btnLabel = '[ !DANGER! ]'; }
                else if (block.type === 'tip') { label = 'SAVE'; labelColor = UNDERTALE_COLORS.yellow; btnLabel = '[ SAVE ]'; }

                return (
                  <View key={bIdx} style={{ marginVertical: 20, padding: 20, borderWidth: 4, borderColor: labelColor, backgroundColor: UNDERTALE_COLORS.black }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, justifyContent: isBlockRtl ? 'flex-end' : 'flex-start' }}>
                      <UndertaleHeart color={labelColor} />
                      <Text style={{ fontSize: 14, color: labelColor, fontFamily: 'PressStart2P', marginLeft: 15 }}>
                        {btnLabel}
                      </Text>
                    </View>
                    <View style={{ borderTopWidth: 2, borderTopColor: labelColor, paddingTop: 15 }}>
                      <UndertaleRichText text={content} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.white, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                    </View>
                  </View>
                );

              case 'bento':
              case 'expandable':
              case 'reveal':
              case 'container':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, padding: 20, borderWidth: 4, borderColor: UNDERTALE_COLORS.white, backgroundColor: '#050505', position: 'relative' }}>
                     {/* Decorative Slot Patterns */}
                     <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, flexDirection: 'row' }}>
                       {Array.from({ length: 20 }).map((_, i) => (
                         <View key={i} style={{ flex: 1, height: 2, backgroundColor: i % 2 === 0 ? UNDERTALE_COLORS.white : 'transparent' }} />
                       ))}
                     </View>
                     
                     <View style={{ marginBottom: 15, borderBottomWidth: 2, borderBottomColor: UNDERTALE_COLORS.white, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ marginRight: 10 }}><Rect width="12" height="12" fill={UNDERTALE_COLORS.white} /></View>
                        <Text style={{ fontSize: 10, color: UNDERTALE_COLORS.white, fontFamily: 'PressStart2P' }}>[ INVENTORY ]</Text>
                     </View>
                     
                     <View style={{ gap: 12 }}>
                        {(block.blocks || []).map((subBlock, sIdx) => (
                          <View key={sIdx} style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 10, backgroundColor: '#111111', borderWidth: 1, borderColor: '#333333' }}>
                            <View style={{ marginRight: 12, marginTop: 4 }}>
                               <Rect width="6" height="6" fill={sIdx % 3 === 0 ? UNDERTALE_COLORS.red : sIdx % 3 === 1 ? UNDERTALE_COLORS.orange : UNDERTALE_COLORS.yellow} />
                            </View>
                            <View style={{ flex: 1 }}>
                               <UndertaleRichText text={subBlock.content || ''} baseStyle={{ fontSize: 14, color: UNDERTALE_COLORS.white, lineHeight: 1.6, textAlign: isArabic(prepareInteractiveSyntax(subBlock.content || '')) ? 'right' : 'left' }} />
                            </View>
                          </View>
                        ))}
                     </View>
                  </View>
                );

              default:
                return (
                  <View key={bIdx} style={{ marginBottom: 12 }}>
                     <UndertaleRichText text={content} baseStyle={{ 
                       fontSize: 14, 
                       fontFamily: 'DotGothic16', 
                       color: UNDERTALE_COLORS.white,
                       lineHeight: 1.6,
                       textAlign: isBlockRtl ? 'right' : 'left' 
                     }} />
                  </View>
                );
            }
          })}
          
          <View fixed style={{ position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 4, borderTopColor: UNDERTALE_COLORS.white, paddingTop: 10 }}>
            <Text style={{ fontSize: 12, color: UNDERTALE_COLORS.white, fontFamily: 'DotGothic16' }}>{doc.title}</Text>
            <Text style={{ fontSize: 12, color: UNDERTALE_COLORS.white, fontFamily: 'DotGothic16' }} render={({ pageNumber, totalPages }) => `LV ${pageNumber} / ${totalPages}`} />
          </View>

        </Page>
      ))}
    </Document>
  );
};

import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Line, Circle, Rect, Polygon, Font } from '@react-pdf/renderer';

Font.register({
  family: 'Bangers',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/bangers/v25/FeVQS0BTqb0h60ACL5k.ttf', fontWeight: 400 },
  ]
});

Font.register({
  family: 'Nunito',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshRTM.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDFwmRTM.ttf', fontWeight: 700 }, // bold
  ]
});

// Cairo for Arabic
Font.register({
  family: 'Cairo',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf', fontWeight: 700 }
  ]
});

const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);
const getTitleFontFamily = (text: string) => isArabic(text) ? 'Cairo' : 'Bangers';
const getBodyFontFamily = (text: string) => isArabic(text) ? 'Cairo' : 'Nunito';

const TADC_COLORS = {
  red: '#FF3366',
  blue: '#33CCFF',
  yellow: '#FFCC00',
  purple: '#9933FF',
  green: '#33FF99',
  black: '#1A1A1A',
  white: '#FFFFFF',
  checkerLight: '#F5F5F5',
  checkerDark: '#E0E0E0'
};

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

const TadcRichText = ({ text, baseStyle }: { text: string; baseStyle: any }): any => {
  if (!text) return <Text style={baseStyle}>{" "}</Text>;
  const processed = prepareInteractiveSyntax(text);
  const parts = processed.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|==.*?==|@@[^@]+@@)/g);

  if (parts.length === 1 && !processed.match(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|==.*?==|@@[^@]+@@)/)) {
    return <Text style={{ ...baseStyle, fontFamily: getBodyFontFamily(processed) }}>{processed}</Text>;
  }

  return (
    <Text style={baseStyle}>
      {parts.filter(Boolean).map((part, i) => {
        let style: any = {
          ...baseStyle,
          fontFamily: getBodyFontFamily(part)
        };

        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
          const content = part.slice(2, -2);
          return <TadcRichText key={i} text={content} baseStyle={{ ...style, fontWeight: 700, fontFamily: getTitleFontFamily(content) }} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <TadcRichText key={i} text={content} baseStyle={{ ...style }} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          return <TadcRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: TADC_COLORS.yellow, color: TADC_COLORS.black }} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = '#FFFFFF';
          style.backgroundColor = TADC_COLORS.black;
          return <Text key={i} style={style}>{content}</Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.color = TADC_COLORS.purple;
          return <Text key={i} style={style}>{`[🎪 ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

const getTitleShadow = (color: string) => {
  return [
    { color, x: -3, y: 3 },
    { color, x: -2, y: 2 },
    { color, x: -1, y: 1 },
  ];
};

const TADC_BACKGROUND_SHAPES = [
  // Top left
  <Polygon key="s1" points="40,80 50,60 70,70 50,90" fill={TADC_COLORS.blue} fillOpacity={0.3} />,
  <Circle key="c1" cx="80" cy="120" r="15" fill={TADC_COLORS.red} fillOpacity={0.3} />,
  // Top right
  <Polygon key="s2" points="520,70 540,60 550,80 530,90" fill={TADC_COLORS.green} fillOpacity={0.3} />,
  <Circle key="c2" cx="490" cy="110" r="10" fill={TADC_COLORS.purple} fillOpacity={0.3} />,
  // Bottom left
  <Polygon key="s3" points="30,760 50,730 80,740 60,780" fill={TADC_COLORS.yellow} fillOpacity={0.3} />,
  <Circle key="c3" cx="90" cy="710" r="20" fill={TADC_COLORS.blue} fillOpacity={0.3} />,
  // Bottom right
  <Polygon key="s4" points="530,750 560,730 570,770 540,790" fill={TADC_COLORS.red} fillOpacity={0.3} />,
  <Circle key="c4" cx="500" cy="720" r="12" fill={TADC_COLORS.purple} fillOpacity={0.3} />,
  // Middle left
  <Circle key="c5" cx="40" cy="400" r="18" fill={TADC_COLORS.yellow} fillOpacity={0.3} />,
  // Middle right
  <Circle key="c6" cx="550" cy="450" r="14" fill={TADC_COLORS.green} fillOpacity={0.3} />,
];

const CircusBackground = () => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} viewBox="0 0 595 842">
    {/* Base cream color */}
    <Rect x="0" y="0" width="595" height="842" fill="#FEFCE8" />
    
    {/* Checkerboard subtle pattern */}
    {Array.from({ length: 42 }).map((_, yi) => {
      const rects = [];
      for (let xi = 0; xi < 30; xi++) {
        if ((xi + yi) % 2 === 0) {
          rects.push(<Rect key={`${xi}-${yi}`} x={xi * 20} y={yi * 20} width="20" height="20" fill="#FFFBEB" />);
        }
      }
      return rects;
    })}

    {TADC_BACKGROUND_SHAPES}

    {/* Circus Tent scallops at top */}
    <Rect x="0" y="0" width="595" height="40" fill={TADC_COLORS.red} />
    {Array.from({ length: 15 }).map((_, i) => (
      <Circle key={`red-scallop-${i}`} cx={i * 40 + 20} cy="40" r="20" fill={TADC_COLORS.red} />
    ))}
    
    <Rect x="0" y="0" width="595" height="30" fill={TADC_COLORS.blue} />
    {Array.from({ length: 15 }).map((_, i) => (
      <Circle key={`blue-scallop-${i}`} cx={i * 40 + 20} cy="30" r="20" fill={TADC_COLORS.blue} />
    ))}

    <Rect x="0" y="0" width="595" height="20" fill={TADC_COLORS.yellow} />
    {Array.from({ length: 15 }).map((_, i) => (
      <Circle key={`yellow-scallop-${i}`} cx={i * 40 + 20} cy="20" r="20" fill={TADC_COLORS.yellow} />
    ))}
  </Svg>
);

const CheckerBackground = () => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} viewBox="0 0 595 842">
    <Rect x="0" y="0" width="595" height="842" fill={TADC_COLORS.purple} />
    {Array.from({ length: Math.ceil(842 / 40) }).map((_, yi) => {
      const rects = [];
      for (let xi = 0; xi < Math.ceil(595 / 40); xi++) {
        if ((xi + yi) % 2 === 0) {
          rects.push(<Rect key={`${xi}-${yi}`} x={xi * 40} y={yi * 40} width="40" height="40" fill="#2E0A4F" />);
        }
      }
      return rects;
    })}
  </Svg>
);

const TadcBox = ({ children, style, boxColor = TADC_COLORS.blue, shadowColor = TADC_COLORS.red }: { children: any, style?: any, boxColor?: string, shadowColor?: string }) => (
  <View style={{ position: 'relative', marginBottom: 20 }}>
    <View style={{
      position: 'absolute',
      top: 6,
      left: -6,
      right: 6,
      bottom: -6,
      backgroundColor: shadowColor,
      borderRadius: 16,
    }} />
    <View style={{
      backgroundColor: '#FFFFFF',
      borderWidth: 4,
      borderColor: boxColor,
      borderStyle: 'dashed',
      borderRadius: 16,
      padding: 16,
      ...style
    }}>
      {children}
    </View>
  </View>
);

const TicketBox = ({ children, style, boxColor = TADC_COLORS.yellow, borderColor = TADC_COLORS.red }: { children: any, style?: any, boxColor?: string, borderColor?: string }) => (
  <View style={{ position: 'relative', marginBottom: 20 }}>
    <View style={{
      position: 'absolute',
      top: 4,
      left: 4,
      right: -4,
      bottom: -4,
      backgroundColor: TADC_COLORS.black,
    }} />
    <View style={{
      backgroundColor: boxColor,
      borderWidth: 3,
      borderColor: borderColor,
      borderStyle: 'dashed',
      padding: 16,
      ...style
    }}>
      {children}
    </View>
  </View>
);

const CurtainBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ position: 'relative', marginBottom: 20 }}>
    <View style={{
      position: 'absolute',
      top: 6,
      left: 6,
      right: -6,
      bottom: -6,
      backgroundColor: TADC_COLORS.yellow,
    }} />
    <View style={{
      backgroundColor: '#FFFFFF',
      borderWidth: 4,
      borderColor: TADC_COLORS.black,
      padding: 20,
      paddingTop: 30,
      ...style
    }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 15, backgroundColor: TADC_COLORS.red, overflow: 'hidden' }} />
      <Svg style={{ position: 'absolute', top: 15, left: 0, right: 0, height: 10 }} viewBox="0 0 595 10">
        {Array.from({ length: 40 }).map((_, i) => (
           <Circle key={i} cx={i * 15 + 7.5} cy={-5} r={10} fill={TADC_COLORS.red} />
        ))}
        {Array.from({ length: 40 }).map((_, i) => (
           <Circle key={i} cx={i * 15 + 7.5} cy={-5} r={8} fill={TADC_COLORS.black} stroke={TADC_COLORS.black} strokeWidth={2} />
        ))}
      </Svg>
      {children}
    </View>
  </View>
);

const BubbleBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ position: 'relative', marginBottom: 20, marginLeft: 20 }}>
    <View style={{
      backgroundColor: '#FFFFFF',
      borderWidth: 4,
      borderColor: TADC_COLORS.blue,
      borderRadius: 30,
      padding: 16,
      ...style
    }}>
      {children}
    </View>
    <View style={{ position: 'absolute', left: -16, top: 20 }}>
       <Svg width="20" height="20" viewBox="0 0 20 20">
         <Polygon points="20,0 20,20 0,10" fill="#FFFFFF" />
         <Line x1="20" y1="0" x2="0" y2="10" stroke={TADC_COLORS.blue} strokeWidth="4" />
         <Line x1="0" y1="10" x2="20" y2="20" stroke={TADC_COLORS.blue} strokeWidth="4" />
       </Svg>
    </View>
  </View>
);

const MagicCardBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ position: 'relative', marginBottom: 20 }}>
    <View style={{
      position: 'absolute',
      top: 6,
      left: 6,
      right: -6,
      bottom: -6,
      backgroundColor: TADC_COLORS.black,
      borderRadius: 10,
    }} />
    <View style={{
      backgroundColor: TADC_COLORS.purple,
      borderWidth: 4,
      borderColor: TADC_COLORS.black,
      borderRadius: 10,
      padding: 6,
      ...style
    }}>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 6, padding: 16, borderWidth: 2, borderColor: TADC_COLORS.yellow, position: 'relative' }}>
         <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
           <Circle cx={8} cy={8} r={4} fill={TADC_COLORS.yellow} />
         </Svg>
        {children}
      </View>
    </View>
  </View>
);

const FlashcardFlipBox = ({ front, back, isBlockRtl }: any) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
     {/* Front */}
     <View style={{ flex: 1, marginRight: 10 }}>
       <View style={{ backgroundColor: TADC_COLORS.red, borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: 5, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Bangers', color: TADC_COLORS.yellow }}>FRONT</Text>
       </View>
       <View style={{ backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: TADC_COLORS.red, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, padding: 15, borderTopWidth: 0, minHeight: 60 }}>
          <TadcRichText text={front} baseStyle={{ fontSize: 13, color: TADC_COLORS.black, textAlign: isBlockRtl ? 'right' : 'left' }} />
       </View>
     </View>
     {/* Back */}
     <View style={{ flex: 1, marginLeft: 10 }}>
       <View style={{ backgroundColor: TADC_COLORS.blue, borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: 5, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Bangers', color: TADC_COLORS.yellow }}>BACK</Text>
       </View>
       <View style={{ backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: TADC_COLORS.blue, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, padding: 15, borderTopWidth: 0, minHeight: 60 }}>
          <TadcRichText text={back} baseStyle={{ fontSize: 13, color: TADC_COLORS.black, textAlign: isBlockRtl ? 'right' : 'left' }} />
       </View>
     </View>
  </View>
);

export const ReactPdfOutputTADC = ({
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
  const globalDocColors = [TADC_COLORS.blue, TADC_COLORS.red, TADC_COLORS.purple, TADC_COLORS.green];

  return (
    <Document title="Digital Circus Document" author="System">
      {includeCover ? (
        <Page size="A4" style={{ position: 'relative' }}>
          <CheckerBackground />
          <View style={{ flex: 1, padding: 40, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
              backgroundColor: TADC_COLORS.yellow,
              padding: 40,
              borderWidth: 6,
              borderColor: TADC_COLORS.red,
              borderRadius: 30,
              width: '100%',
              alignItems: 'center',
              transform: 'rotate(-2deg)',
            }}>
              <Text style={{
                fontSize: 60,
                color: TADC_COLORS.blue,
                fontFamily: 'Bangers',
                textAlign: 'center',
                transform: 'rotate(2deg)',
                marginBottom: 20,
              }}>
                {groupsOrder.length > 1 ? groupsOrder.join(' & ') : (documents[0]?.title || 'MY DIGITAL DOCUMENT')}
              </Text>
              
              <View style={{
                backgroundColor: TADC_COLORS.purple,
                padding: 10,
                paddingHorizontal: 20,
                borderRadius: 20,
                transform: 'rotate(1deg)',
              }}>
                <Text style={{
                  fontSize: 24,
                  color: TADC_COLORS.white,
                  fontFamily: 'Bangers',
                }}>
                  {isExam ? 'THE BIG EXAM!' : 'THE AMAZING CIRCUS GUIDE'}
                </Text>
              </View>
            </View>
          </View>
        </Page>
      ) : []}

      {documents.map((doc, dIdx) => (
        <Page key={dIdx} size="A4" style={{ padding: 40, paddingBottom: 60 }}>
          <CircusBackground />
          
          <View style={{ marginBottom: 30 }}>
            {/* Title */}
            <View style={{
              backgroundColor: TADC_COLORS.red,
              padding: 15,
              borderRadius: 20,
              transform: 'rotate(-1deg)',
              alignSelf: 'flex-start',
              marginBottom: 20,
              borderWidth: 3,
              borderColor: TADC_COLORS.black,
            }}>
              <Text style={{
                fontSize: 28,
                color: TADC_COLORS.white,
                fontFamily: getTitleFontFamily(doc.title),
                textAlign: isArabic(doc.title) ? 'right' : 'left'
              }}>
                {doc.title}
              </Text>
            </View>
          </View>

          {doc.blocks.map((block, bIdx) => {
            const content = block.content || '';
            const isBlockRtl = isArabic(prepareInteractiveSyntax(content));

            switch (block.type) {
              case 'heading':
              case 'subheading':
                return (
                  <View key={bIdx} style={{ marginTop: 20, marginBottom: 10, alignSelf: isBlockRtl ? 'flex-end' : 'flex-start' }}>
                    <Text style={{
                      fontSize: block.type === 'heading' ? 24 : 20,
                      color: block.type === 'heading' ? TADC_COLORS.purple : TADC_COLORS.blue,
                      fontFamily: getTitleFontFamily(content),
                      textAlign: isBlockRtl ? 'right' : 'left',
                    }}>{content}</Text>
                    {block.type === 'heading' ? <View style={{ height: 4, backgroundColor: TADC_COLORS.yellow, width: '100%', marginTop: 2 }} /> : []}
                  </View>
                );

              case 'subtitle':
                return (
                  <Text key={bIdx} style={{ fontSize: 16, color: TADC_COLORS.red, fontFamily: getTitleFontFamily(content), marginTop: 10, marginBottom: 8, textAlign: isBlockRtl ? 'right' : 'left' }}>
                    {content}
                  </Text>
                );

              case 'image':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, alignItems: 'center' }}>
                    <View style={{
                      borderWidth: 5,
                      borderColor: TADC_COLORS.yellow,
                      borderRadius: 20,
                      padding: 5,
                      backgroundColor: TADC_COLORS.white,
                      transform: 'rotate(1deg)'
                    }}>
                      <Image src={block.content} style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 15 }} />
                      <Text style={{ textAlign: 'center', marginTop: 10, fontFamily: 'Bangers', fontSize: 16, color: TADC_COLORS.red }}>
                        {block.imageCaption || 'A WACKY PICTURE!'}
                      </Text>
                    </View>
                  </View>
                );

              case 'dialogue':
                return (
                  <BubbleBox key={bIdx}>
                    <Text style={{ fontSize: 13, fontFamily: getBodyFontFamily(content), color: TADC_COLORS.black, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }}>
                      <TadcRichText text={content} baseStyle={{}} />
                    </Text>
                  </BubbleBox>
                );

              case 'summary':
              case 'high_yield':
                return (
                  <TicketBox key={bIdx} boxColor={TADC_COLORS.yellow} borderColor={TADC_COLORS.red}>
                    <Text style={{ fontSize: 18, color: TADC_COLORS.red, fontFamily: 'Bangers', marginBottom: 5, textAlign: isBlockRtl ? 'right' : 'left' }}>
                      {block.type === 'summary' ? '~ SUMMARY ~' : '!!! IMPORTANT !!!'}
                    </Text>
                    <TadcRichText text={content} baseStyle={{ fontSize: 13, color: TADC_COLORS.black, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }} />
                  </TicketBox>
                );

              case 'quote':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, paddingHorizontal: 20 }}>
                    <Text style={{ fontSize: 40, color: TADC_COLORS.purple, fontFamily: 'Bangers', top: -10, left: 0 }}>"</Text>
                    <Text style={{ fontSize: 16, color: TADC_COLORS.black, fontFamily: getTitleFontFamily(content), paddingLeft: 20, paddingRight: 20, textAlign: isBlockRtl ? 'right' : 'left' }}>
                      <TadcRichText text={content} baseStyle={{}} />
                    </Text>
                    <Text style={{ fontSize: 40, color: TADC_COLORS.purple, fontFamily: 'Bangers', bottom: -20, right: 0 }}>"</Text>
                  </View>
                );

              case 'vocabulary':
                return (
                  <MagicCardBox key={bIdx}>
                    <Text style={{ fontSize: 16, color: TADC_COLORS.purple, fontFamily: getTitleFontFamily(block.term || ''), marginBottom: 5, textAlign: isBlockRtl ? 'right' : 'left' }}>
                      {block.term || 'TERM'}
                    </Text>
                    <View style={{ height: 2, backgroundColor: TADC_COLORS.checkerDark, marginBottom: 5 }} />
                    <TadcRichText text={block.definition || content} baseStyle={{ fontSize: 13, color: TADC_COLORS.black, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }} />
                  </MagicCardBox>
                );

              case 'flashcard':
                return (
                  <FlashcardFlipBox 
                    key={bIdx}
                    front={block.front || block.term || content || 'Front'}
                    back={block.back || block.definition || 'Back'}
                    isBlockRtl={isBlockRtl}
                  />
                );

              case 'list':
                return (
                  <View key={bIdx} style={{ marginVertical: 10, paddingLeft: isBlockRtl ? 0 : 15, paddingRight: isBlockRtl ? 15 : 0 }}>
                    {(block.items || content.split('\n')).map((item, i) => (
                      <View key={i} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', marginBottom: 6, alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 14, color: TADC_COLORS.yellow, fontFamily: 'Bangers', marginRight: isBlockRtl ? 0 : 8, marginLeft: isBlockRtl ? 8 : 0, marginTop: 2 }}>★</Text>
                        <Text style={{ flex: 1, fontSize: 13, fontFamily: getBodyFontFamily(item), color: TADC_COLORS.black, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }}>
                          <TadcRichText text={item} baseStyle={{}} />
                        </Text>
                      </View>
                    ))}
                  </View>
                );

              case 'step':
                return (
                  <View key={bIdx} style={{ marginVertical: 10 }}>
                    {(block.items || content.split('\n')).map((item, i) => (
                      <View key={i} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', marginBottom: 10, alignItems: 'center' }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: TADC_COLORS.blue, justifyContent: 'center', alignItems: 'center', marginRight: isBlockRtl ? 0 : 10, marginLeft: isBlockRtl ? 10 : 0 }}>
                          <Text style={{ color: TADC_COLORS.white, fontFamily: 'Bangers', fontSize: 14 }}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#FFFFFF', padding: 10, borderRadius: 10, borderWidth: 2, borderColor: TADC_COLORS.blue, borderStyle: 'dashed' }}>
                          <Text style={{ fontSize: 13, fontFamily: getBodyFontFamily(item), color: TADC_COLORS.black, textAlign: isBlockRtl ? 'right' : 'left' }}>
                            <TadcRichText text={item} baseStyle={{}} />
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );

              case 'code':
                return (
                  <View key={bIdx} style={{ marginVertical: 12, backgroundColor: TADC_COLORS.black, padding: 15, borderRadius: 10, borderWidth: 3, borderColor: TADC_COLORS.green }}>
                    <Text style={{ color: TADC_COLORS.green, fontFamily: 'Courier', fontSize: 12, lineHeight: 1.5 }}>
                      {content}
                    </Text>
                  </View>
                );

              case 'horizontal_rule':
                return (
                  <View key={bIdx} style={{ marginVertical: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <Circle key={i} cx={0} cy={0} r={4} fill={i % 2 === 0 ? TADC_COLORS.red : TADC_COLORS.yellow} />
                    ))}
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
                      <View key={bIdx} style={{ marginVertical: 12 }}>
                        <View style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', borderBottomWidth: 3, borderBottomColor: TADC_COLORS.black, paddingBottom: 6, marginBottom: 6 }}>
                          {header.map((v, i) => (
                            <View key={i} style={{ flex: 1, padding: 4 }}>
                              <Text style={{ fontSize: 13, fontFamily: getTitleFontFamily(v), color: TADC_COLORS.blue, fontWeight: 700, textAlign: isBlockRtl ? 'right' : 'left' }}>
                                <TadcRichText text={v} baseStyle={{}} />
                              </Text>
                            </View>
                          ))}
                        </View>
                        {rows.map((row, rI) => (
                          <View key={rI} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', borderBottomWidth: 1, borderBottomColor: TADC_COLORS.checkerDark, borderStyle: 'dashed', paddingBottom: 4, marginBottom: 4 }}>
                            {row.map((val, cI) => (
                              <View key={cI} style={{ flex: 1, padding: 4 }}>
                                 <Text style={{ fontSize: 12, fontFamily: getBodyFontFamily(val), color: TADC_COLORS.black, textAlign: isBlockRtl ? 'right' : 'left' }}>
                                   <TadcRichText text={val} baseStyle={{}} />
                                 </Text>
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
                     <TadcRichText text={content} baseStyle={{ fontSize: 13, fontFamily: getTitleFontFamily(content), color: TADC_COLORS.black, lineHeight: 1.5, textAlign: isBlockRtl ? 'right' : 'left' }} />
                  </View>
                );

              case 'example':
              case 'explanation':
              case 'note':
              case 'warning':
              case 'tip':
              case 'clinical_correlation':
                let boxColor = TADC_COLORS.blue;
                let shadowColor = TADC_COLORS.red;
                let label = 'NOTICE';
                
                if (block.type === 'example') { boxColor = TADC_COLORS.green; shadowColor = TADC_COLORS.purple; label = 'EXAMPLE!'; }
                else if (block.type === 'explanation') { boxColor = TADC_COLORS.blue; shadowColor = TADC_COLORS.yellow; label = 'EXPLANATION!'; }
                else if (block.type === 'note' || block.type === 'clinical_correlation') { boxColor = TADC_COLORS.yellow; shadowColor = TADC_COLORS.red; label = 'HEY LISTEN!'; }
                else if (block.type === 'warning') { boxColor = TADC_COLORS.red; shadowColor = TADC_COLORS.black; label = 'DANGER!'; }
                else if (block.type === 'tip') { boxColor = TADC_COLORS.purple; shadowColor = TADC_COLORS.green; label = 'PRO-TIP!'; }

                return (
                  <View wrap={false} key={bIdx} style={{ marginVertical: 12 }}>
                    <TadcBox boxColor={boxColor} shadowColor={shadowColor} style={{ backgroundColor: '#FFFFFF' }}>
                      <Text style={{ fontSize: 16, color: boxColor, fontFamily: 'Bangers', marginBottom: 5, textAlign: isBlockRtl ? 'right' : 'left' }}>
                        {label}
                      </Text>
                      <TadcRichText text={content} baseStyle={{ fontSize: 13, color: TADC_COLORS.black, textAlign: isBlockRtl ? 'right' : 'left' }} />
                    </TadcBox>
                  </View>
                );

              case 'bento':
              case 'expandable':
              case 'reveal':
              case 'container':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, padding: 10, borderWidth: 3, borderColor: TADC_COLORS.black, borderStyle: 'dashed', borderRadius: 10 }}>
                     {(block.blocks || []).map((subBlock, sIdx) => (
                       <View key={sIdx} style={{ marginBottom: 5 }}>
                         <TadcRichText text={subBlock.content || ''} baseStyle={{ fontSize: 13, color: TADC_COLORS.black, lineHeight: 1.5, fontFamily: getBodyFontFamily(subBlock.content || ''), textAlign: isArabic(prepareInteractiveSyntax(subBlock.content || '')) ? 'right' : 'left' }} />
                       </View>
                     ))}
                  </View>
                );

              default:
                // Paragraph and fallback
                return (
                  <View key={bIdx} style={{ marginBottom: 12 }}>
                     <TadcRichText text={content} baseStyle={{ 
                       fontSize: 13, 
                       fontFamily: getBodyFontFamily(content), 
                       color: TADC_COLORS.black,
                       lineHeight: 1.5,
                       textAlign: isBlockRtl ? 'right' : 'left' 
                     }} />
                  </View>
                );
            }
          })}
          
          <View fixed style={{ position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 3, borderTopStyle: 'dashed', borderTopColor: TADC_COLORS.red, paddingTop: 10 }}>
            <Text style={{ fontSize: 14, color: TADC_COLORS.blue, fontFamily: 'Bangers' }}>{doc.title}</Text>
            <Text style={{ fontSize: 14, color: TADC_COLORS.purple, fontFamily: 'Bangers' }} render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`} />
          </View>

        </Page>
      ))}
    </Document>
  );
};

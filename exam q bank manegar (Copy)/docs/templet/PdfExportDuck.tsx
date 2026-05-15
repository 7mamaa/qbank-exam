import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Circle, Font } from '@react-pdf/renderer';

Font.register({
  family: 'Quicksand',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/quicksand/v37/6xK-dSZaM9iE8KbpRA_LJ3z8mH9BOJvgkP8o18E.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/quicksand/v37/6xK-dSZaM9iE8KbpRA_LJ3z8mH9BOJvgkBgv18E.ttf', fontWeight: 700 }, // bold
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
const getFontFamily = (text: string) => isArabic(text) ? 'Cairo' : 'Quicksand';

const DUCK_COLORS = {
  yellow: '#FFD166',
  orange: '#F4A261',
  darkOrange: '#E76F51',
  blue: '#A2D2FF',
  white: '#FFFFFF',
  text: '#264653',
  lightGray: '#F8F9FA'
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
  // Clean up problematic characters requested by user
  t = t.replace(/[º¶]/g, "");
  return t;
};

const DuckRichText = ({ text, baseStyle }: { text: string; baseStyle: any }): any => {
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
          return <DuckRichText key={i} text={content} baseStyle={{ ...style, fontWeight: 700 }} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <DuckRichText key={i} text={content} baseStyle={{ ...style, color: DUCK_COLORS.darkOrange }} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          return <DuckRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: DUCK_COLORS.yellow, color: DUCK_COLORS.text }} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = DUCK_COLORS.darkOrange;
          style.backgroundColor = DUCK_COLORS.lightGray;
          return <Text key={i} style={style}> {content} </Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.color = DUCK_COLORS.blue;
          return <Text key={i} style={style}>{`[QUACK! ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

const DuckBackground = () => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
    <Path d="M0,0 L595,0 L595,842 L0,842 Z" fill="#FFFDF7" />
    
    {/* Clouds */}
    <Path d="M-20,100 Q 20,80 60,100 Q 100,80 140,100 Q 120,130 60,130 Q 0,130 -20,100 Z" fill="#FFFFFF" fillOpacity="0.8" />
    <Path d="M480,200 Q 510,180 540,200 Q 570,180 600,200 Q 580,230 540,230 Q 500,230 480,200 Z" fill="#FFFFFF" fillOpacity="0.8" />
    <Path d="M100,450 Q 130,430 160,450 Q 190,430 220,450 Q 200,480 160,480 Q 120,480 100,450 Z" fill="#FFFFFF" fillOpacity="0.8" />
    <Path d="M350,600 Q 380,580 410,600 Q 440,580 470,600 Q 450,630 410,630 Q 370,630 350,600 Z" fill="#FFFFFF" fillOpacity="0.8" />

    {/* Bubbles */}
    <Circle cx="80" cy="250" r="10" fill="#E0F2FE" fillOpacity="0.6" stroke="#BAE6FD" strokeWidth="2" />
    <Circle cx="100" cy="220" r="6" fill="#E0F2FE" fillOpacity="0.6" stroke="#BAE6FD" strokeWidth="2" />
    <Circle cx="50" cy="280" r="15" fill="#E0F2FE" fillOpacity="0.6" stroke="#BAE6FD" strokeWidth="2" />
    
    <Circle cx="520" cy="380" r="12" fill="#E0F2FE" fillOpacity="0.6" stroke="#BAE6FD" strokeWidth="2" />
    <Circle cx="550" cy="350" r="8" fill="#E0F2FE" fillOpacity="0.6" stroke="#BAE6FD" strokeWidth="2" />
    <Circle cx="480" cy="400" r="18" fill="#E0F2FE" fillOpacity="0.6" stroke="#BAE6FD" strokeWidth="2" />

    <Circle cx="200" cy="700" r="14" fill="#E0F2FE" fillOpacity="0.6" stroke="#BAE6FD" strokeWidth="2" />
    <Circle cx="230" cy="670" r="9" fill="#E0F2FE" fillOpacity="0.6" stroke="#BAE6FD" strokeWidth="2" />
    <Circle cx="170" cy="730" r="20" fill="#E0F2FE" fillOpacity="0.6" stroke="#BAE6FD" strokeWidth="2" />
    
    {/* Water waves at the bottom */}
    <Path d="M0,800 Q 150,780 300,810 T 595,780 L 595,842 L 0,842 Z" fill={DUCK_COLORS.blue} opacity="0.3" />
    <Path d="M0,820 Q 150,800 300,830 T 595,800 L 595,842 L 0,842 Z" fill={DUCK_COLORS.blue} opacity="0.5" />
    
    {/* Sun/Duck hint at top right */}
    <Path d="M500,-20 A 80 80 0 0 1 615,95 Z" fill={DUCK_COLORS.yellow} opacity="0.8" />
  </Svg>
);

const SoftBox = ({ children, style, borderColor = DUCK_COLORS.orange, bgColor = DUCK_COLORS.white }: { children: any, style?: any, borderColor?: string, bgColor?: string }) => (
  <View style={{
    backgroundColor: bgColor,
    borderWidth: 2,
    borderColor: borderColor,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    ...style
  }}>
    {children}
  </View>
);

const PondBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#E0F2FE', borderBottomWidth: 6, borderBottomColor: '#7DD3FC', borderRadius: 20, padding: 16, marginBottom: 16, ...style }}>{children}</View>
);

const EggBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#FEFCE8', borderWidth: 3, borderColor: '#FEF08A', borderRadius: 30, padding: 16, marginBottom: 16, ...style }}>{children}</View>
);

const NestBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#FFF7ED', borderBottomWidth: 6, borderBottomColor: '#FB923C', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, marginBottom: 16, ...style }}>{children}</View>
);

const BeakBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#FFEDD5', borderLeftWidth: 8, borderLeftColor: '#F97316', borderRadius: 12, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, padding: 16, marginBottom: 16, ...style }}>{children}</View>
);

const FeatherBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 24, padding: 16, marginBottom: 16, ...style }}>{children}</View>
);

export const ReactPdfOutputDuck = ({
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
    <Document title="Duck Document" author="System">
      {includeCover ? (
        <Page size="A4" style={{ position: 'relative' }}>
          <DuckBackground />
          <View style={{ flex: 1, padding: 50, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
              backgroundColor: DUCK_COLORS.white,
              padding: 40,
              borderRadius: 40,
              borderWidth: 4,
              borderColor: DUCK_COLORS.yellow,
              width: '100%',
              alignItems: 'center',
            }}>
              <Text style={{
                fontSize: 48,
                color: DUCK_COLORS.darkOrange,
                fontFamily: 'Quicksand',
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: 20,
              }}>
                {groupsOrder.length > 1 ? groupsOrder.join(' & ') : (documents[0]?.title || 'MY DUCK DOCUMENT')}
              </Text>
              
              <View style={{
                backgroundColor: DUCK_COLORS.blue,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 25,
              }}>
                <Text style={{
                  fontSize: 20,
                  color: DUCK_COLORS.text,
                  fontFamily: 'Quicksand',
                  fontWeight: 700,
                }}>
                  {isExam ? 'Quack Exam!' : 'A Friendly Guide'}
                </Text>
              </View>
            </View>
          </View>
        </Page>
      ) : []}

      {documents.map((doc, dIdx) => (
        <Page key={dIdx} size="A4" style={{ padding: 40, paddingBottom: 60, position: 'relative' }}>
          <DuckBackground />
          
          <View style={{ marginBottom: 30 }}>
            {/* Title */}
            <View style={{
              alignSelf: 'stretch',
              borderBottomWidth: 3,
              borderBottomColor: DUCK_COLORS.yellow,
              paddingBottom: 10,
              marginBottom: 10,
            }}>
              <Text style={{
                fontSize: 32,
                color: DUCK_COLORS.darkOrange,
                fontFamily: getFontFamily(doc.title),
                fontWeight: 700,
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
                  <View key={bIdx} style={{ marginTop: 20, marginBottom: 10 }}>
                    <DuckRichText 
                      text={content} 
                      baseStyle={{
                        fontSize: block.type === 'heading' ? 22 : 18,
                        color: block.type === 'heading' ? DUCK_COLORS.text : DUCK_COLORS.orange,
                        fontWeight: 700,
                        textAlign: isBlockRtl ? 'right' : 'left',
                      }} 
                    />
                  </View>
                );

              case 'subtitle':
                return (
                  <View key={bIdx} style={{ marginTop: 10, marginBottom: 8 }}>
                    <DuckRichText 
                      text={content} 
                      baseStyle={{ 
                        fontSize: 16, 
                        color: DUCK_COLORS.blue, 
                        textAlign: isBlockRtl ? 'right' : 'left' 
                      }} 
                    />
                  </View>
                );

              case 'image':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, alignItems: 'center' }}>
                    <View style={{
                      borderRadius: 20,
                      padding: 10,
                      backgroundColor: DUCK_COLORS.white,
                      borderWidth: 2,
                      borderColor: DUCK_COLORS.blue,
                    }}>
                      <Image src={block.content} style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 12 }} />
                      <Text style={{ textAlign: 'center', marginTop: 10, fontFamily: 'Quicksand', fontSize: 14, color: DUCK_COLORS.text }}>
                        {block.imageCaption || 'A cute picture!'}
                      </Text>
                    </View>
                  </View>
                );

              case 'dialogue':
                return (
                  <View key={bIdx} style={{ position: 'relative', marginBottom: 20, marginLeft: isBlockRtl ? 0 : 15, marginRight: isBlockRtl ? 15 : 0 }}>
                    <View style={{ backgroundColor: '#FFF3E0', borderWidth: 2, borderColor: '#F4A261', borderRadius: 20, borderBottomLeftRadius: isBlockRtl ? 20 : 0, borderBottomRightRadius: isBlockRtl ? 0 : 20, padding: 16 }}>
                      <DuckRichText text={content} baseStyle={{ fontSize: 13, color: '#B45309', textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                    </View>
                  </View>
                );

              case 'summary':
              case 'high_yield':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, padding: 16, backgroundColor: DUCK_COLORS.yellow, borderRadius: 24, borderWidth: 3, borderColor: DUCK_COLORS.darkOrange, borderStyle: 'dashed' }}>
                    <Text style={{ fontSize: 16, color: DUCK_COLORS.darkOrange, fontWeight: 700, fontFamily: 'Quicksand', marginBottom: 5, textAlign: isBlockRtl ? 'right' : 'left' }}>
                      {block.type === 'summary' ? '~ Wrapped Up! ~' : '! Quack Note !'}
                    </Text>
                    <DuckRichText text={content} baseStyle={{ fontSize: 13, color: '#78350F', textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                  </View>
                );

              case 'quote':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, padding: 20, backgroundColor: '#F0F9FF', borderRadius: 20, position: 'relative', overflow: 'hidden' }}>
                    <Text style={{ position: 'absolute', top: -5, left: 10, fontSize: 60, color: '#BAE6FD', fontFamily: 'Quicksand', fontWeight: 700, opacity: 0.5 }}>"</Text>
                    <Text style={{ fontSize: 15, color: '#0C4A6E', fontFamily: getFontFamily(content), fontStyle: 'italic', textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6, paddingHorizontal: 15, zIndex: 1 }}>
                      <DuckRichText text={content} baseStyle={{}} />
                    </Text>
                    <Text style={{ position: 'absolute', bottom: -35, right: 10, fontSize: 60, color: '#BAE6FD', fontFamily: 'Quicksand', fontWeight: 700, opacity: 0.5 }}>"</Text>
                  </View>
                );

              case 'vocabulary':
                return (
                  <View key={bIdx} style={{ marginVertical: 12, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, borderLeftWidth: 6, borderLeftColor: DUCK_COLORS.blue, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <View style={{ marginBottom: 5 }}>
                      <DuckRichText text={`• ${block.term || 'TERM'}`} baseStyle={{ fontSize: 16, color: DUCK_COLORS.blue, fontWeight: 700, textAlign: isBlockRtl ? 'right' : 'left' }} />
                    </View>
                    <DuckRichText text={block.definition || content} baseStyle={{ fontSize: 13, color: '#334155', textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                  </View>
                );

              case 'flashcard':
                return (
                  <View key={bIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                    <View style={{ flex: 1, marginRight: 10, borderRadius: 16, borderWidth: 2, borderColor: DUCK_COLORS.orange, backgroundColor: '#FFF7ED', overflow: 'hidden' }}>
                      <View style={{ backgroundColor: DUCK_COLORS.orange, padding: 6, alignItems: 'center' }}>
                         <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: 700, fontFamily: 'Quicksand', letterSpacing: 1 }}>Q U E S T I O N</Text>
                      </View>
                      <View style={{ padding: 15, minHeight: 60, justifyContent: 'center' }}>
                        <DuckRichText text={block.front || block.term || content || ''} baseStyle={{ fontSize: 13, color: '#78350F', textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10, borderRadius: 16, borderWidth: 2, borderColor: DUCK_COLORS.blue, backgroundColor: '#F0F9FF', overflow: 'hidden' }}>
                      <View style={{ backgroundColor: DUCK_COLORS.blue, padding: 6, alignItems: 'center' }}>
                         <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: 700, fontFamily: 'Quicksand', letterSpacing: 1 }}>A N S W E R</Text>
                      </View>
                      <View style={{ padding: 15, minHeight: 60, justifyContent: 'center' }}>
                        <DuckRichText text={block.back || block.definition || ''} baseStyle={{ fontSize: 13, color: '#0C4A6E', textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                      </View>
                    </View>
                  </View>
                );

              case 'list':
                return (
                  <View key={bIdx} style={{ marginVertical: 10, paddingLeft: isBlockRtl ? 0 : 15, paddingRight: isBlockRtl ? 15 : 0 }}>
                    {(block.items || content.split('\n')).map((item, i) => (
                      <View key={i} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', marginBottom: 8, alignItems: 'flex-start' }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DUCK_COLORS.yellow, borderWidth: 2, borderColor: DUCK_COLORS.orange, marginTop: 4, marginRight: isBlockRtl ? 0 : 10, marginLeft: isBlockRtl ? 10 : 0 }} />
                        <Text style={{ flex: 1, fontSize: 13, fontFamily: getFontFamily(item), color: DUCK_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }}>
                          <DuckRichText text={item} baseStyle={{}} />
                        </Text>
                      </View>
                    ))}
                  </View>
                );

              case 'step':
                return (
                  <View key={bIdx} style={{ marginVertical: 16, backgroundColor: '#E0F2FE', padding: 16, borderRadius: 24, borderWidth: 2, borderColor: '#BAE6FD' }}>
                    {(block.items || content.split('\n')).map((item, i) => (
                      <View key={i} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', marginBottom: 10, alignItems: 'center' }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: isBlockRtl ? 0 : 12, marginLeft: isBlockRtl ? 12 : 0, borderWidth: 2, borderColor: '#38BDF8' }}>
                          <Text style={{ color: '#0369A1', fontFamily: 'Quicksand', fontWeight: 700, fontSize: 14 }}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontFamily: getFontFamily(item), color: '#0C4A6E', textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }}>
                            <DuckRichText text={item} baseStyle={{}} />
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );

              case 'code':
                return (
                  <View key={bIdx} style={{ marginVertical: 12, backgroundColor: '#1E293B', padding: 16, borderRadius: 16, borderTopWidth: 6, borderTopColor: '#38BDF8' }}>
                    <Text style={{ color: '#E0F2FE', fontFamily: 'Courier', fontSize: 12, lineHeight: 1.6 }}>
                      {content}
                    </Text>
                  </View>
                );

              case 'horizontal_rule':
                return (
                  <View key={bIdx} style={{ marginVertical: 20, alignItems: 'center' }}>
                    <View style={{ width: '50%', height: 2, backgroundColor: DUCK_COLORS.yellow, borderRadius: 1 }} />
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
                      <View key={bIdx} style={{ marginVertical: 12, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: DUCK_COLORS.blue }}>
                        <View style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', backgroundColor: DUCK_COLORS.blue, padding: 8 }}>
                          {header.map((v, i) => (
                            <View key={i} style={{ flex: 1, padding: 4 }}>
                              <Text style={{ fontSize: 13, fontFamily: getFontFamily(v), color: DUCK_COLORS.white, fontWeight: 700, textAlign: isBlockRtl ? 'right' : 'left' }}>
                                <DuckRichText text={v} baseStyle={{}} />
                              </Text>
                            </View>
                          ))}
                        </View>
                        {rows.map((row, rI) => (
                          <View key={rI} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', backgroundColor: rI % 2 === 0 ? DUCK_COLORS.white : DUCK_COLORS.lightGray, padding: 8 }}>
                            {row.map((val, cI) => (
                              <View key={cI} style={{ flex: 1, padding: 4 }}>
                                 <Text style={{ fontSize: 12, fontFamily: getFontFamily(val), color: DUCK_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left' }}>
                                   <DuckRichText text={val} baseStyle={{}} />
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
                     <DuckRichText text={content} baseStyle={{ fontSize: 13, fontFamily: getFontFamily(content), color: DUCK_COLORS.text, lineHeight: 1.6, textAlign: isBlockRtl ? 'right' : 'left' }} />
                  </View>
                );

              case 'example':
              case 'explanation':
              case 'note':
              case 'warning':
              case 'tip':
              case 'clinical_correlation':
                let BoxComp = SoftBox;
                let label = 'NOTICE';
                let labelColor = DUCK_COLORS.blue;
                
                if (block.type === 'example') { BoxComp = PondBox; label = 'EXAMPLE'; labelColor = '#0369A1'; }
                else if (block.type === 'explanation') { BoxComp = EggBox; label = 'EXPLANATION'; labelColor = '#CA8A04'; }
                else if (block.type === 'note' || block.type === 'clinical_correlation') { BoxComp = NestBox; label = 'NOTE'; labelColor = '#C2410C'; }
                else if (block.type === 'warning') { BoxComp = BeakBox; label = 'WATCH OUT!'; labelColor = '#C2410C'; }
                else if (block.type === 'tip') { BoxComp = FeatherBox; label = 'PRO-TIP'; labelColor = '#64748B'; }

                return (
                  <BoxComp key={bIdx}>
                    <Text style={{ fontSize: 14, color: labelColor, fontFamily: 'Quicksand', fontWeight: 700, marginBottom: 5, textAlign: isBlockRtl ? 'right' : 'left' }}>
                      {label}
                    </Text>
                    <DuckRichText text={content} baseStyle={{ fontSize: 13, color: '#334155', textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.6 }} />
                  </BoxComp>
                );

              case 'bento':
              case 'expandable':
              case 'reveal':
              case 'container':
                return (
                  <View key={bIdx} style={{ marginVertical: 15, padding: 16, borderWidth: 3, borderColor: '#7DD3FC', borderStyle: 'dotted', borderRadius: 24, backgroundColor: '#F0F9FF' }}>
                     {(block.blocks || []).map((subBlock, sIdx) => (
                       <View key={sIdx} style={{ marginBottom: 5 }}>
                         <DuckRichText text={subBlock.content || ''} baseStyle={{ fontSize: 13, color: '#0C4A6E', lineHeight: 1.6, fontFamily: getFontFamily(subBlock.content || ''), textAlign: isArabic(prepareInteractiveSyntax(subBlock.content || '')) ? 'right' : 'left' }} />
                       </View>
                     ))}
                  </View>
                );

              default:
                // Paragraph and fallback
                return (
                  <View key={bIdx} style={{ marginBottom: 12 }}>
                     <DuckRichText text={content} baseStyle={{ 
                       fontSize: 13, 
                       fontFamily: getFontFamily(content), 
                       color: DUCK_COLORS.text,
                       lineHeight: 1.6,
                       textAlign: isBlockRtl ? 'right' : 'left' 
                     }} />
                  </View>
                );
            }
          })}
          
          <View fixed style={{ position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: DUCK_COLORS.yellow, paddingTop: 10 }}>
            <Text style={{ fontSize: 12, color: DUCK_COLORS.orange, fontFamily: 'Quicksand', fontWeight: 700 }}>{doc.title}</Text>
            <Text style={{ fontSize: 12, color: DUCK_COLORS.blue, fontFamily: 'Quicksand', fontWeight: 700 }} render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`} />
          </View>

        </Page>
      ))}
    </Document>
  );
};

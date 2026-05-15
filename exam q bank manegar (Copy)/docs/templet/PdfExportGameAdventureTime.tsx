import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Circle, Font } from '@react-pdf/renderer';

// Register fun, bubbly fonts for Adventure Time theme
Font.register({
  family: 'Nunito',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshRTM.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/nunito/v32/XRXI3I6Li01BKofiOc5wtlZ2di8HDFwmRTM.ttf', fontWeight: 700 }, // bold
  ]
});

// Cairo for Arabic fallback
Font.register({
  family: 'Cairo',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf', fontWeight: 700 }
  ]
});

const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);
const getFontFamily = (text: string) => isArabic(text) ? 'Cairo' : 'Nunito';

const ADVENTURE_COLORS = {
  finnBlue: '#4FB2E7',
  finnHatWhite: '#FFFFFF',
  jakeYellow: '#FFD13B',
  jakeNoseBlack: '#101010',
  'bmoGreen-light': '#91C4A5',
  bmoGreen: '#61A375',
  marcelineRed: '#D63138',
  pbPink: '#F2A4C2',
  pbDarkPink: '#E15089',
  skyBlue: '#A9E3FF',
  grassGreen: '#7ED957',
  text: '#1F2937', // Dark gray
  lightGray: '#F3F4F6'
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
  t = t.replace(/[º¶]/g, "");
  return t;
};

const AdventureRichText = ({ text, baseStyle }: { text: string; baseStyle: any }): any => {
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
          return <AdventureRichText key={i} text={content} baseStyle={{ ...style, fontWeight: 700 }} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <AdventureRichText key={i} text={content} baseStyle={{ ...style, color: ADVENTURE_COLORS.pbDarkPink }} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          return <AdventureRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: ADVENTURE_COLORS.jakeYellow, color: ADVENTURE_COLORS.text }} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = ADVENTURE_COLORS.marcelineRed;
          style.backgroundColor = ADVENTURE_COLORS.finnHatWhite;
          style.borderRadius = 4;
          return <Text key={i} style={style}> {content} </Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.color = ADVENTURE_COLORS.finnBlue;
          return <Text key={i} style={style}>{`[Algebraic! ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

const Background = () => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
    {/* Sky */}
    <Path d="M0,0 L595,0 L595,842 L0,842 Z" fill="#E6F7FF" />
    <Path d="M0,0 L595,0 L595,400 L0,400 Z" fill="#BAE6FD" />
    
    {/* Clouds - organic soft shapes */}
    <Path d="M-50,80 C 10,60 50,40 100,70 C 140,50 180,60 200,90 C 230,80 280,100 250,130 C 220,160 100,150 50,140 C 20,135 -30,120 -50,80" fill="#FFFFFF" opacity="0.8" />
    <Path d="M400,120 C 430,90 480,80 520,110 C 560,90 600,120 620,150 C 650,190 550,200 500,190 C 450,180 380,180 400,120" fill="#FFFFFF" opacity="0.7" />
    <Path d="M150,220 C 180,200 220,210 240,240 C 270,230 320,250 290,280 C 260,310 140,300 90,290 C 60,285 130,250 150,220" fill="#FFFFFF" opacity="0.6" />

    {/* Distant Hills */}
    <Path d="M0,600 Q 150,450 300,550 T 600,480 L 600,842 L 0,842 Z" fill="#A7F3D0" opacity="0.6" />
    
    {/* Grass Hills at bottom */}
    <Path d="M-50,750 Q 80,650 250,700 T 650,600 L 650,842 L -50,842 Z" fill="#86EFAC" opacity="0.8" />
    <Path d="M0,842 Q 200,700 595,780 L 595,842 L 0,842 Z" fill={ADVENTURE_COLORS.grassGreen} />

  </Svg>
);

const WobblyBox = ({ children, style, wrap = false, borderColor = '#000000', bgColor = '#FFFFFF', borderWidth = 3 }: { children: any, style?: any, wrap?: boolean, borderColor?: string, bgColor?: string, borderWidth?: number }) => (
  <View wrap={wrap} style={{
    backgroundColor: bgColor,
    borderWidth: borderWidth,
    borderColor: borderColor,
    borderRadius: 25, // Soft bouncy corners
    padding: 16,
    marginBottom: 16,
    ...style
  }}>
    {children}
  </View>
);

export const ReactPdfOutputGameAdventureTime = ({
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
    <Document title="Adventure Time Document" author="Jake the Dog">
      {includeCover ? (
        <Page size="A4" style={{ position: 'relative' }}>
          <Background />
          <View style={{ flex: 1, padding: 50, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
              backgroundColor: '#FFFFFF', // Finn's hat color
              padding: 40,
              borderRadius: 50,
              borderWidth: 6,
              borderColor: ADVENTURE_COLORS.jakeYellow, // Jake color
              width: '100%',
              alignItems: 'center',
              shadowColor: '#101010',
              shadowOffset: { width: 4, height: 6 },
              shadowOpacity: 0.15,
            }}>
              <Text style={{
                fontSize: 48,
                color: ADVENTURE_COLORS.finnBlue,
                fontFamily: 'Nunito',
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: 20,
              }}>
                {groupsOrder.length > 1 ? groupsOrder.join(' & ') : (documents[0]?.title || 'MATHEMATICAL DOCUMENT')}
              </Text>
              
              <View style={{
                backgroundColor: ADVENTURE_COLORS.pbPink,
                paddingVertical: 12,
                paddingHorizontal: 30,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: ADVENTURE_COLORS.pbDarkPink,
              }}>
                <Text style={{
                  fontSize: 22,
                  color: '#FFFFFF',
                  fontFamily: 'Nunito',
                  fontWeight: 700,
                }}>
                  {isExam ? 'Adventure Exam!' : 'Ooo Guidebook'}
                </Text>
              </View>
            </View>
          </View>
        </Page>
      ) : []}

      {documents.map((doc, dIdx) => (
        <Page key={dIdx} size="A4" style={{ padding: 40, paddingBottom: 60, position: 'relative' }}>
          <Background />
          
          <View style={{ marginBottom: 30 }}>
            {/* Title */}
            <View style={{
              alignSelf: 'stretch',
              backgroundColor: '#FFFFFF',
              borderRadius: 30,
              borderWidth: 4,
              borderColor: ADVENTURE_COLORS.finnBlue,
              padding: 15,
              paddingLeft: 25,
              marginBottom: 10,
            }}>
              <Text style={{
                fontSize: 32,
                color: ADVENTURE_COLORS.jakeNoseBlack,
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
                  <View key={bIdx} wrap={false} style={{ marginTop: 20, marginBottom: 10 }}>
                    <AdventureRichText 
                      text={content} 
                      baseStyle={{
                        fontSize: block.type === 'heading' ? 24 : 20,
                        color: block.type === 'heading' ? ADVENTURE_COLORS.marcelineRed : ADVENTURE_COLORS.pbDarkPink,
                        fontWeight: 700,
                        textAlign: isBlockRtl ? 'right' : 'left',
                      }} 
                    />
                  </View>
                );

              case 'subtitle':
                return (
                  <View key={bIdx} wrap={false} style={{ marginTop: 10, marginBottom: 8 }}>
                    <AdventureRichText 
                      text={content} 
                      baseStyle={{ 
                        fontSize: 16, 
                        color: ADVENTURE_COLORS.jakeNoseBlack, 
                        textAlign: isBlockRtl ? 'right' : 'left' 
                      }} 
                    />
                  </View>
                );

              case 'image':
                return (
                  <View key={bIdx} wrap={false} style={{ marginVertical: 15, alignItems: 'center' }}>
                    <View style={{
                      borderRadius: 30,
                      padding: 15,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 4,
                      borderColor: ADVENTURE_COLORS.jakeYellow,
                    }}>
                      <Image src={block.content} style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 15 }} />
                      <Text style={{ textAlign: 'center', marginTop: 10, fontFamily: 'Nunito', fontSize: 14, color: ADVENTURE_COLORS.text }}>
                        {block.imageCaption || 'Check it out!'}
                      </Text>
                    </View>
                  </View>
                );

              case 'dialogue':
                return (
                  <View key={bIdx} wrap={false} style={{ position: 'relative', marginBottom: 20, marginLeft: isBlockRtl ? 0 : 20, marginRight: isBlockRtl ? 20 : 0 }}>
                    <View style={{ backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: ADVENTURE_COLORS.finnBlue, borderRadius: 25, borderBottomLeftRadius: isBlockRtl ? 25 : 0, borderBottomRightRadius: isBlockRtl ? 0 : 25, padding: 18 }}>
                      <AdventureRichText text={content} baseStyle={{ fontSize: 14, color: ADVENTURE_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }} />
                    </View>
                  </View>
                );

              case 'summary':
              case 'high_yield':
                return (
                  <View key={bIdx} wrap={false} style={{ marginVertical: 15, padding: 18, backgroundColor: ADVENTURE_COLORS.jakeYellow, borderRadius: 25, borderWidth: 4, borderColor: ADVENTURE_COLORS.jakeNoseBlack }}>
                    <Text style={{ fontSize: 18, color: ADVENTURE_COLORS.jakeNoseBlack, fontWeight: 700, fontFamily: 'Nunito', marginBottom: 8, textAlign: isBlockRtl ? 'right' : 'left' }}>
                      {block.type === 'summary' ? '~ ALGEBRAIC SUMMARY ~' : '! SHMOWZOW !'}
                    </Text>
                    <AdventureRichText text={content} baseStyle={{ fontSize: 14, color: ADVENTURE_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }} />
                  </View>
                );

              case 'quote':
                return (
                  <View key={bIdx} wrap={false} style={{ marginVertical: 15, padding: 20, backgroundColor: ADVENTURE_COLORS.pbPink, borderRadius: 30, borderWidth: 3, borderColor: ADVENTURE_COLORS.pbDarkPink, position: 'relative' }}>
                    <Text style={{ fontSize: 16, color: '#FFFFFF', fontFamily: getFontFamily(content), fontWeight: 700, textAlign: isBlockRtl ? 'right' : 'center', lineHeight: 1.6 }}>
                      "{content}"
                    </Text>
                  </View>
                );

              case 'vocabulary':
                return (
                  <View key={bIdx} wrap={false} style={{ marginVertical: 12, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 3, borderColor: ADVENTURE_COLORS.finnBlue }}>
                    <View style={{ marginBottom: 5 }}>
                      <AdventureRichText text={block.term || 'TERM'} baseStyle={{ fontSize: 16, color: ADVENTURE_COLORS.marcelineRed, fontWeight: 700, textAlign: isBlockRtl ? 'right' : 'left' }} />
                    </View>
                    <AdventureRichText text={block.definition || content} baseStyle={{ fontSize: 14, color: ADVENTURE_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }} />
                  </View>
                );

              case 'flashcard':
                return (
                  <View key={bIdx} wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                    <View style={{ flex: 1, marginRight: 10, borderRadius: 20, borderWidth: 3, borderColor: ADVENTURE_COLORS.finnBlue, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
                      <View style={{ backgroundColor: ADVENTURE_COLORS.finnBlue, padding: 8, alignItems: 'center' }}>
                         <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 700, fontFamily: 'Nunito' }}>QUESTION</Text>
                      </View>
                      <View style={{ padding: 15, minHeight: 60, justifyContent: 'center' }}>
                        <AdventureRichText text={block.front || block.term || content || ''} baseStyle={{ fontSize: 14, color: ADVENTURE_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }} />
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10, borderRadius: 20, borderWidth: 3, borderColor: ADVENTURE_COLORS.marcelineRed, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
                      <View style={{ backgroundColor: ADVENTURE_COLORS.marcelineRed, padding: 8, alignItems: 'center' }}>
                         <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 700, fontFamily: 'Nunito' }}>ANSWER</Text>
                      </View>
                      <View style={{ padding: 15, minHeight: 60, justifyContent: 'center' }}>
                        <AdventureRichText text={block.back || block.definition || ''} baseStyle={{ fontSize: 14, color: ADVENTURE_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }} />
                      </View>
                    </View>
                  </View>
                );

              case 'list':
                return (
                  <View key={bIdx} wrap={false} style={{ marginVertical: 10, paddingLeft: isBlockRtl ? 0 : 15, paddingRight: isBlockRtl ? 15 : 0 }}>
                    {(block.items || content.split('\n')).map((item, i) => (
                      <View key={i} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', marginBottom: 8, alignItems: 'flex-start' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ADVENTURE_COLORS.jakeYellow, borderWidth: 2, borderColor: '#101010', marginTop: 4, marginRight: isBlockRtl ? 0 : 10, marginLeft: isBlockRtl ? 10 : 0 }} />
                        <Text style={{ flex: 1, fontSize: 14, fontFamily: getFontFamily(item), color: ADVENTURE_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }}>
                          <AdventureRichText text={item} baseStyle={{}} />
                        </Text>
                      </View>
                    ))}
                  </View>
                );

              case 'step':
                return (
                  <View key={bIdx} wrap={false} style={{ marginVertical: 16, backgroundColor: '#FFFFFF', padding: 18, borderRadius: 25, borderWidth: 3, borderColor: '#7ED957' }}>
                    {(block.items || content.split('\n')).map((item, i) => (
                      <View key={i} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', marginBottom: 12, alignItems: 'center' }}>
                        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: ADVENTURE_COLORS.finnBlue, justifyContent: 'center', alignItems: 'center', marginRight: isBlockRtl ? 0 : 12, marginLeft: isBlockRtl ? 12 : 0, borderWidth: 2, borderColor: '#FFFFFF' }}>
                          <Text style={{ color: '#FFFFFF', fontFamily: 'Nunito', fontWeight: 700, fontSize: 16 }}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontFamily: getFontFamily(item), color: ADVENTURE_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }}>
                            <AdventureRichText text={item} baseStyle={{}} />
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );

              case 'code':
                return (
                  <View key={bIdx} wrap={false} style={{ marginVertical: 12, backgroundColor: '#2D3748', padding: 16, borderRadius: 15, borderWidth: 3, borderColor: '#4A5568' }}>
                    <Text style={{ color: '#E2E8F0', fontFamily: 'Courier', fontSize: 12, lineHeight: 1.6 }}>
                      {content}
                    </Text>
                  </View>
                );

              case 'horizontal_rule':
                return (
                  <View key={bIdx} wrap={false} style={{ marginVertical: 20, alignItems: 'center' }}>
                    <View style={{ width: '50%', height: 4, backgroundColor: ADVENTURE_COLORS.jakeYellow, borderRadius: 2 }} />
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
                      <View key={bIdx} wrap={false} style={{ marginVertical: 12, borderRadius: 20, overflow: 'hidden', borderWidth: 3, borderColor: ADVENTURE_COLORS.finnBlue, backgroundColor: '#FFFFFF' }}>
                        <View style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', backgroundColor: ADVENTURE_COLORS.finnBlue, padding: 10 }}>
                          {header.map((v, i) => (
                            <View key={i} style={{ flex: 1, padding: 4 }}>
                              <Text style={{ fontSize: 14, fontFamily: getFontFamily(v), color: '#FFFFFF', fontWeight: 700, textAlign: isBlockRtl ? 'right' : 'left' }}>
                                <AdventureRichText text={v} baseStyle={{}} />
                              </Text>
                            </View>
                          ))}
                        </View>
                        {rows.map((row, rI) => (
                          <View key={rI} style={{ flexDirection: isBlockRtl ? 'row-reverse' : 'row', backgroundColor: rI % 2 === 0 ? '#FFFFFF' : '#E6F7FF', padding: 8, borderTopWidth: 2, borderTopColor: '#BAE6FD' }}>
                            {row.map((val, cI) => (
                              <View key={cI} style={{ flex: 1, padding: 4 }}>
                                 <Text style={{ fontSize: 13, fontFamily: getFontFamily(val), color: ADVENTURE_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left' }}>
                                   <AdventureRichText text={val} baseStyle={{}} />
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
                  <View key={bIdx} wrap={false} style={{ marginBottom: 12 }}>
                     <AdventureRichText text={content} baseStyle={{ fontSize: 14, fontFamily: getFontFamily(content), color: ADVENTURE_COLORS.text, lineHeight: 1.5, textAlign: isBlockRtl ? 'right' : 'left' }} />
                  </View>
                );

              case 'example':
              case 'explanation':
              case 'note':
              case 'warning':
              case 'tip':
              case 'clinical_correlation':
                let label = 'NOTICE';
                let labelColor = ADVENTURE_COLORS.finnBlue;
                let bgColor = '#FFFFFF';
                let borderColor = ADVENTURE_COLORS.finnBlue;
                
                if (block.type === 'example') { label = 'EXAMPLE'; labelColor = ADVENTURE_COLORS.grassGreen; borderColor = ADVENTURE_COLORS.grassGreen; }
                else if (block.type === 'explanation') { label = 'EXPLANATION'; labelColor = ADVENTURE_COLORS.marcelineRed; borderColor = ADVENTURE_COLORS.marcelineRed; }
                else if (block.type === 'note' || block.type === 'clinical_correlation') { label = 'NOTE'; labelColor = ADVENTURE_COLORS.jakeYellow; borderColor = ADVENTURE_COLORS.jakeNoseBlack; bgColor = ADVENTURE_COLORS.jakeYellow; labelColor = ADVENTURE_COLORS.jakeNoseBlack; }
                else if (block.type === 'warning') { label = 'WATCH OUT!'; labelColor = '#FFFFFF'; bgColor = ADVENTURE_COLORS.marcelineRed; borderColor = '#101010'; }
                else if (block.type === 'tip') { label = 'PRO-TIP'; labelColor = '#FFFFFF'; bgColor = ADVENTURE_COLORS.pbPink; borderColor = ADVENTURE_COLORS.pbDarkPink; }

                return (
                  <WobblyBox key={bIdx} wrap={false} bgColor={bgColor} borderColor={borderColor}>
                    <Text style={{ fontSize: 16, color: labelColor, fontFamily: 'Nunito', fontWeight: 700, marginBottom: 5, textAlign: isBlockRtl ? 'right' : 'left' }}>
                      {label}
                    </Text>
                    <AdventureRichText text={content} baseStyle={{ fontSize: 14, color: (block.type === 'warning' || block.type === 'tip') ? '#FFFFFF' : ADVENTURE_COLORS.text, textAlign: isBlockRtl ? 'right' : 'left', lineHeight: 1.5 }} />
                  </WobblyBox>
                );

              case 'bento':
              case 'expandable':
              case 'reveal':
              case 'container':
                return (
                  <View key={bIdx} wrap={false} style={{ marginVertical: 15, padding: 18, borderWidth: 4, borderColor: ADVENTURE_COLORS.finnBlue, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.8)' }}>
                     {(block.blocks || []).map((subBlock, sIdx) => (
                       <View key={sIdx} style={{ marginBottom: 5 }}>
                         <AdventureRichText text={subBlock.content || ''} baseStyle={{ fontSize: 14, color: ADVENTURE_COLORS.text, lineHeight: 1.5, fontFamily: getFontFamily(subBlock.content || ''), textAlign: isArabic(prepareInteractiveSyntax(subBlock.content || '')) ? 'right' : 'left' }} />
                       </View>
                     ))}
                  </View>
                );

              default:
                // Paragraph and fallback
                const mod = bIdx % 4;
                const bgColors = ['#FFFFFF', '#E6F7FF', '#FFF9C4', '#F0FDF4'];
                const borderColors = [ADVENTURE_COLORS.finnBlue, ADVENTURE_COLORS.skyBlue, ADVENTURE_COLORS.jakeYellow, ADVENTURE_COLORS.grassGreen];
                const borderStyles: any[] = ['solid', 'dashed', 'dotted', 'solid'];
                return (
                  <View key={bIdx} wrap={false} style={{ 
                    marginBottom: 12, 
                    padding: 14, 
                    backgroundColor: bgColors[mod],
                    borderRadius: 20,
                    borderWidth: 3,
                    borderColor: borderColors[mod],
                    borderStyle: borderStyles[mod]
                  }}>
                     <AdventureRichText text={content} baseStyle={{ 
                       fontSize: 14, 
                       fontFamily: getFontFamily(content), 
                       color: ADVENTURE_COLORS.text,
                       lineHeight: 1.5,
                       textAlign: isBlockRtl ? 'right' : 'left' 
                     }} />
                  </View>
                );
            }
          })}
          
          <View fixed style={{ position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 3, borderTopColor: ADVENTURE_COLORS.finnBlue, paddingTop: 10 }}>
            <Text style={{ fontSize: 12, color: ADVENTURE_COLORS.finnBlue, fontFamily: 'Nunito', fontWeight: 700 }}>{doc.title}</Text>
            <Text style={{ fontSize: 12, color: ADVENTURE_COLORS.marcelineRed, fontFamily: 'Nunito', fontWeight: 700 }} render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} / ${totalPages}`} />
          </View>

        </Page>
      ))}
    </Document>
  );
};

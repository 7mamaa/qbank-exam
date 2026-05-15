import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Line, Circle, Rect, Polygon, Font } from '@react-pdf/renderer';

Font.register({
  family: 'Space Grotesk',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUUsj.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVksj.ttf', fontWeight: 700 }
  ]
});

Font.register({
  family: 'Space Mono',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/spacemono/v17/i7dPIFZifjKcF5UAWdDRUEY.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/spacemono/v17/i7dMIFZifjKcF5UAWdDRaPpZYFI.ttf', fontWeight: 700 }
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
const getTitleFontFamily = (text: string) => isArabic(text) ? 'Cairo' : 'Space Grotesk';
const getBodyFontFamily = (text: string) => isArabic(text) ? 'Cairo' : 'Space Mono';

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

const BrutalistRichText = ({ text, baseStyle }: { text: string; baseStyle: any }): any => {
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
          fontWeight: baseStyle?.fontWeight || 400,
          color: baseStyle?.color || '#000000',
          fontFamily: getBodyFontFamily(part)
        };

        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
          const content = part.slice(2, -2);
          return <BrutalistRichText key={i} text={content} baseStyle={{ ...style, fontWeight: 700, backgroundColor: '#ffff00', color: '#000000' }} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <BrutalistRichText key={i} text={content} baseStyle={{ ...style, color: '#333333' }} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          return <BrutalistRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: '#000000', color: '#ffffff', padding: '2px 4px' }} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = '#ffffff';
          style.backgroundColor = '#000000';
          style.fontFamily = isArabic(content) ? 'Cairo' : 'Space Mono';
          return <Text key={i} style={style}>{content}</Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.fontWeight = 700;
          style.backgroundColor = '#ff00ff';
          style.color = '#000000';
          return <Text key={i} style={style}>{`[IMG: ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

const BrutalistBlockRenderer = ({ block, docColors, isExam }: { block: PdfBlock, docColors: any, isExam: boolean }) => {
  if (!block) return <View />;
  const content = block.content || '';
  const isRtl = isArabic(prepareInteractiveSyntax(content));

  const applyBoxShadowAndBorders = {
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
    // We simulate hard shadow by having a parent view with black background and offset, 
    // or just using a bottom/right thicker border if possible.
    // For simplicity in React-PDF, we use absolute positioning for shadows or thicker bottom/right borders.
  };

  switch (block.type) {
    case 'heading':
      return (
        <View wrap={false} style={{ marginBottom: 24, marginTop: 40, alignItems: isRtl ? 'flex-end' : 'flex-start', paddingBottom: 8, borderBottomWidth: 4, borderBottomColor: '#000000' }}>
          <BrutalistRichText text={content.toUpperCase()} baseStyle={{ fontSize: 24, fontFamily: getTitleFontFamily(content), fontWeight: 700, color: '#000000', lineHeight: 1.1, letterSpacing: -1 }} />
        </View>
      );
    case 'subheading':
      return (
        <View wrap={false} style={{ marginTop: 24, marginBottom: 12, alignItems: isRtl ? 'flex-end' : 'flex-start', backgroundColor: '#000000', padding: 8 }}>
          <BrutalistRichText text={content} baseStyle={{ fontSize: 16, fontFamily: getTitleFontFamily(content), fontWeight: 700, color: '#ffffff', textAlign: isRtl ? 'right' : 'left' }} />
        </View>
      );
    case 'subtitle':
      return (
        <View wrap={false} style={{ marginTop: 16, marginBottom: 8, alignSelf: isRtl ? 'flex-end' : 'flex-start', borderWidth: 1, borderColor: '#000000', padding: 4, backgroundColor: '#ffff00' }}>
          <BrutalistRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Space Mono', fontWeight: 700, color: '#000000', textAlign: isRtl ? 'right' : 'left', textTransform: 'uppercase' }} />
        </View>
      );
    case 'paragraph':
    case 'text':
    case 'plain':
      if (content.trim() === '') return <View style={{ height: 10 }} />;
      return (
        <View style={{ marginBottom: 16 }}>
          <BrutalistRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Space Mono', lineHeight: 1.4, color: '#000000', textAlign: isRtl ? 'right' : 'left' }} />
        </View>
      );
    case 'example': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 16, ...applyBoxShadowAndBorders, borderBottomWidth: 6, borderRightWidth: 6 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#000000', backgroundColor: '#00ff00', padding: 4, alignSelf: isBoxRtl ? 'flex-end' : 'flex-start', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>EXAMPLE</Text>
              <BrutalistRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Space Mono', color: '#000000', lineHeight: 1.4, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'explanation': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 16, ...applyBoxShadowAndBorders, backgroundColor: '#eeeeee', borderBottomWidth: 4, borderRightWidth: 4 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#ffffff', backgroundColor: '#000000', padding: 4, alignSelf: isBoxRtl ? 'flex-end' : 'flex-start', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>EXPLANATION</Text>
              <BrutalistRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Space Mono', color: '#000000', lineHeight: 1.4, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'note': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 16, ...applyBoxShadowAndBorders, backgroundColor: '#ffff00', borderBottomWidth: 4, borderRightWidth: 4 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, color: '#000000', backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#000000', padding: 4, alignSelf: isBoxRtl ? 'flex-end' : 'flex-start', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>NOTE</Text>
              <BrutalistRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Space Mono', color: '#000000', lineHeight: 1.4, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'warning': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 16, ...applyBoxShadowAndBorders, backgroundColor: '#ff0000', borderBottomWidth: 6, borderRightWidth: 6 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, color: '#ff0000', backgroundColor: '#000000', padding: 4, alignSelf: isBoxRtl ? 'flex-end' : 'flex-start', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>WARNING</Text>
              <BrutalistRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Space Mono', color: '#ffffff', fontWeight: 700, lineHeight: 1.4, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'tip': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 16, ...applyBoxShadowAndBorders, backgroundColor: '#00ffff', borderBottomWidth: 4, borderRightWidth: 4 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
               <Text style={{ fontSize: 12, color: '#ffffff', backgroundColor: '#000000', padding: 4, alignSelf: isBoxRtl ? 'flex-end' : 'flex-start', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>TIP</Text>
              <BrutalistRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Space Mono', color: '#000000', lineHeight: 1.4, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'high_yield': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 16, ...applyBoxShadowAndBorders, backgroundColor: '#000000', borderBottomWidth: 6, borderRightWidth: 6, borderColor: '#ffff00' }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, color: '#000000', backgroundColor: '#ffff00', padding: 4, alignSelf: isBoxRtl ? 'flex-end' : 'flex-start', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>HIGH YIELD</Text>
              <BrutalistRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Space Mono', color: '#ffffff', fontWeight: 700, lineHeight: 1.4, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'clinical_correlation': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 16, ...applyBoxShadowAndBorders, borderColor: '#0000ff', borderBottomWidth: 4, borderRightWidth: 4 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, color: '#ffffff', backgroundColor: '#0000ff', padding: 4, alignSelf: isBoxRtl ? 'flex-end' : 'flex-start', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>CLINICAL</Text>
              <BrutalistRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Space Mono', color: '#000000', lineHeight: 1.4, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'list':
      const isOrdered = (block as any).style === 'ordered';
      return (
        <View style={{ marginVertical: 12 }}>
          {(block.items || []).map((item, i) => {
            const isItemRtl = isArabic(prepareInteractiveSyntax(item));
            return (
              <View wrap={false} key={i} style={{ flexDirection: isItemRtl ? 'row-reverse' : 'row', marginBottom: 12, alignItems: 'center', backgroundColor: '#eeeeee', padding: 8, borderWidth: 2, borderColor: '#000000' }}>
                <View style={{ width: 32, alignItems: 'center', justifyContent: 'center' }}>
                  {isOrdered ? (
                    <Text style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', backgroundColor: '#000000', padding: 4, fontFamily: 'Space Mono' }}>{i + 1}</Text>
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: 700, color: '#000000', fontFamily: 'Space Mono' }}>{">"}</Text>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: isItemRtl ? 0 : 12, marginRight: isItemRtl ? 12 : 0 }}>
                  <BrutalistRichText text={item} baseStyle={{ fontSize: 11, fontFamily: 'Space Mono', lineHeight: 1.4, color: '#000000', textAlign: isItemRtl ? 'right' : 'left' }} />
                </View>
              </View>
            );
          })}
        </View>
      );
    case 'step':
      return (
        <View style={{ marginVertical: 20, flexDirection: 'column' }}>
          {(block.items || []).map((item, i) => {
            const isItemRtl = isArabic(prepareInteractiveSyntax(item));
            return (
              <View wrap={false} key={i} style={{ flexDirection: isItemRtl ? 'row-reverse' : 'row', backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#000000', borderBottomWidth: 4, borderRightWidth: 4, padding: 16, marginBottom: 16, alignItems: 'flex-start' }}>
                <View style={{ width: 40, height: 40, backgroundColor: '#ffff00', borderWidth: 2, borderColor: '#000000', justifyContent: 'center', alignItems: 'center', marginLeft: isItemRtl ? 16 : 0, marginRight: isItemRtl ? 0 : 16 }}>
                  <Text style={{ color: '#000000', fontWeight: 700, fontSize: 16, fontFamily: 'Space Grotesk' }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, marginTop: 4 }}>
                  <BrutalistRichText text={item} baseStyle={{ fontSize: 12, fontFamily: 'Space Mono', lineHeight: 1.4, color: '#000000', textAlign: isItemRtl ? 'right' : 'left' }} />
                </View>
              </View>
            );
          })}
        </View>
      );
    case 'quote':
      const isQuoteRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 24, padding: 24, backgroundColor: '#000000' }}>
          <Text style={{ fontSize: 40, color: '#ffff00', fontFamily: 'Space Grotesk', marginBottom: -20 }}>"</Text>
          <BrutalistRichText text={content.toUpperCase()} baseStyle={{ fontSize: 16, fontFamily: 'Space Grotesk', fontWeight: 700, color: '#ffffff', textAlign: isQuoteRtl ? 'right' : 'left', lineHeight: 1.2, marginLeft: 20 }} />
        </View>
      );
    case 'vocabulary':
      const vocabIsRtl = isArabic(prepareInteractiveSyntax(block.term || '') + prepareInteractiveSyntax(block.definition || ''));
      return (
        <View wrap={false} style={{ marginVertical: 16, flexDirection: vocabIsRtl ? 'row-reverse' : 'column', alignItems: 'stretch', borderWidth: 2, borderColor: '#000000', borderBottomWidth: 6, borderRightWidth: 6 }}>
          <View style={{ backgroundColor: '#000000', padding: 12, justifyContent: 'center', alignItems: vocabIsRtl ? 'flex-end' : 'flex-start' }}>
            <BrutalistRichText text={block.term || ''} baseStyle={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, color: '#ffffff', textAlign: vocabIsRtl ? 'right' : 'left' }} />
          </View>
          <View style={{ backgroundColor: '#ffffff', padding: 16, justifyContent: 'center' }}>
            <BrutalistRichText text={block.definition || ''} baseStyle={{ fontFamily: 'Space Mono', fontSize: 11, lineHeight: 1.4, color: '#000000', textAlign: vocabIsRtl ? 'right' : 'left' }} />
          </View>
        </View>
      );
    case 'code':
      return (
        <View wrap={false} style={{ marginVertical: 16, backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#000000', borderBottomWidth: 6, borderRightWidth: 6, padding: 16 }}>
          <View style={{ backgroundColor: '#000000', padding: 4, alignSelf: 'flex-start', marginBottom: 8 }}>
            <Text style={{ color: '#ffffff', fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 700 }}>CODE</Text>
          </View>
          <Text style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#000000', lineHeight: 1.4 }}>
            {content}
          </Text>
        </View>
      );
    case 'summary':
      return (
        <View wrap={false} style={{ marginVertical: 24, padding: 24, backgroundColor: '#ffff00', borderWidth: 4, borderColor: '#000000' }}>
          <Text style={{ fontSize: 24, color: '#000000', fontFamily: getTitleFontFamily(content), fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', textDecoration: 'underline' }}>SUMMARY</Text>
          <BrutalistRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Space Mono', color: '#000000', lineHeight: 1.4 }} />
        </View>
      );
    case 'reference':
      return (
        <View wrap={false} style={{ marginVertical: 8, padding: 8, backgroundColor: '#eeeeee', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#000000' }}>
          <Text style={{ fontSize: 9, fontFamily: 'Space Mono', color: '#000000' }}>
            REF: {content}
          </Text>
        </View>
      );
    case 'dialogue':
      return (
        <View wrap={false} style={{ marginVertical: 12, padding: 16, backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#000000', alignSelf: 'flex-start', maxWidth: '80%' }}>
          <BrutalistRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Space Mono', color: '#000000', lineHeight: 1.4 }} />
        </View>
      );
    case 'flashcard': {
      const frontContent = block.front || content || 'Flashcard';
      const backContent = block.back || '';
      const isCardRtl = isArabic(prepareInteractiveSyntax(frontContent + backContent));
      return (
        <View wrap={false} style={{ marginVertical: 24, backgroundColor: '#ffffff', borderWidth: 4, borderColor: '#000000', borderBottomWidth: 8, borderRightWidth: 8 }}>
          <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 100, backgroundColor: '#000000' }}>
            <Text style={{ fontSize: 12, color: '#ffff00', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Space Grotesk', fontWeight: 700 }}>FRONT</Text>
            <BrutalistRichText text={frontContent.toUpperCase()} baseStyle={{ fontSize: 16, fontFamily: 'Space Grotesk', color: '#ffffff', textAlign: 'center', fontWeight: 700, lineHeight: 1.2 }} />
          </View>
          {backContent ? (
            <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center', borderTopWidth: 4, borderColor: '#000000', backgroundColor: '#ffffff' }}>
               <Text style={{ fontSize: 12, color: '#000000', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Space Grotesk', fontWeight: 700, backgroundColor: '#00ffff', padding: 4 }}>BACK</Text>
              <BrutalistRichText text={backContent} baseStyle={{ fontSize: 12, fontFamily: 'Space Mono', color: '#000000', textAlign: isCardRtl ? 'right' : 'center', lineHeight: 1.4 }} />
            </View>
          ) : []}
        </View>
      );
    }
    case 'caption':
      return (
        <View wrap={false} style={{ marginTop: 8, marginBottom: 16, alignItems: 'center' }}>
          <BrutalistRichText text={content} baseStyle={{ fontSize: 10, fontFamily: 'Space Mono', color: '#000000', backgroundColor: '#eeeeee', padding: 4, borderWidth: 1, borderColor: '#000000', textAlign: 'center' }} />
        </View>
      );
    case 'horizontal_rule':
      return <View style={{ height: 4, backgroundColor: '#000000', marginVertical: 32 }} />;
    case 'page_break':
      return <View break />;
    case 'essay_area':
      return (
        <View wrap={false} style={{ marginVertical: 24 }}>
          <Text style={{ fontSize: 14, color: '#ffffff', backgroundColor: '#000000', padding: 8, alignSelf: 'flex-start', fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>{content || "NOTES"}</Text>
          <View style={{ height: 200, backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#000000', borderBottomWidth: 6, borderRightWidth: 6 }}>
             {/* Lines for writing */}
          </View>
        </View>
      );
    case 'bento':
    case 'expandable':
    case 'reveal':
    case 'container':
      return (
        <View wrap={false} style={{ marginVertical: 24, padding: 24, backgroundColor: '#ffffff', borderWidth: 4, borderColor: '#000000' }}>
          <View style={{ flexDirection: 'column' }}>
            {block.blocks?.map((child, idx) => (
              <View key={idx} style={{ marginBottom: idx === block.blocks!.length - 1 ? 0 : 16 }}>
                 <BrutalistBlockRenderer block={child} docColors={docColors} isExam={isExam} />
              </View>
            ))}
          </View>
        </View>
      );
    case 'table':
      return (
        <View wrap={false} style={{ marginVertical: 24, borderWidth: 4, borderColor: '#000000', borderBottomWidth: 8, borderRightWidth: 8 }}>
          {block.columns && block.columns.length > 0 ? (
            <View style={{ flexDirection: 'row', backgroundColor: '#000000', padding: 12 }}>
              {block.columns.map((col, cIdx) => (
                <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4 }}>
                  <BrutalistRichText text={col.toUpperCase()} baseStyle={{ fontSize: 12, fontWeight: 700, color: '#ffffff', fontFamily: 'Space Grotesk' }} />
                </View>
              ))}
            </View>
          ) : []}
          <View style={{ flexDirection: 'column' }}>
            {(block.rows || []).map((row, rIdx) => (
              <View key={rIdx} style={{ flexDirection: 'row', backgroundColor: '#ffffff', padding: 12, borderBottomWidth: rIdx === block.rows!.length - 1 ? 0 : 2, borderColor: '#000000' }}>
                {row.map((cell, cIdx) => (
                  <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4, borderRightWidth: cIdx === row.length - 1 ? 0 : 2, borderRightColor: '#000000' }}>
                    <BrutalistRichText text={cell} baseStyle={{ fontSize: 11, color: '#000000', fontFamily: 'Space Mono', lineHeight: 1.4 }} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    case 'image':
      return (
        <View wrap={false} style={{ marginVertical: 24, alignItems: 'center' }}>
          <View style={{ borderWidth: 4, borderColor: '#000000', borderBottomWidth: 8, borderRightWidth: 8 }}>
            <Image src={block.imageUrl || ''} style={{ width: 480, height: 'auto', objectFit: 'cover' }} />
          </View>
          {block.imageCaption ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 10, color: '#000000', backgroundColor: '#ffff00', padding: 4, fontFamily: 'Space Mono', borderWidth: 1, borderColor: '#000000' }}>{block.imageCaption}</Text>
            </View>
          ) : <View />}
        </View>
      );
    default:
      return (
        <View style={{ marginBottom: 8 }}>
          <BrutalistRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Space Mono', color: '#000000' }} />
        </View>
      );
  }
};

const BrutalistTableOfContents = ({ documents, docColors }: { documents: PdfDocument[], docColors: any }) => {
  const tocItems: { title: string; page: number }[] = [];
  let currentPage = 2; // Cover is 1, TOC is 2

  documents.forEach((doc, idx) => {
    tocItems.push({ title: doc.title || `Document ${idx + 1}`, page: currentPage });
    const blocksCount = doc.blocks.length;
    currentPage += Math.ceil(blocksCount / 5) || 1; 
  });

  return (
    <Page size="A4" style={{ backgroundColor: '#ffffff', padding: 40 }}>
      {/* Grid background approximation */}
      <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
        {Array.from({ length: 42 }).map((_, i) => (
          <Line key={`h${i}`} x1="0" y1={i * 20} x2="595" y2={i * 20} stroke="#f0f0f0" strokeWidth="1" />
        ))}
        {Array.from({ length: 30 }).map((_, i) => (
          <Line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="842" stroke="#f0f0f0" strokeWidth="1" />
        ))}
      </Svg>

      <View style={{ marginBottom: 40, borderBottomWidth: 4, borderBottomColor: '#000000', paddingBottom: 16 }}>
        <Text style={{ fontSize: 40, fontFamily: 'Space Grotesk', fontWeight: 700, color: '#000000', letterSpacing: -2, textTransform: 'uppercase' }}>INDEX</Text>
      </View>

      <View>
        {tocItems.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomStyle: 'dashed', borderBottomColor: '#000000' }}>
            <Text style={{ fontSize: 14, color: '#000000', fontWeight: 700, fontFamily: 'Space Mono' }}>{prepareInteractiveSyntax(item.title).toUpperCase()}</Text>
            <Text style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', backgroundColor: '#000000', padding: '2px 8px', fontFamily: 'Space Grotesk' }}>{String(i + (tocItems.length > 0 ? 3 : 2)).padStart(2, '0')}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
};

export const ReactPdfOutputBrutalist = ({ 
  documents, 
  themeColor, 
  includeToc = true,
  includeCover = true,
  customTheme,
  colorSequence = ['indigo'],
  isExam = false
}: { 
  documents: PdfDocument[]; 
  themeColor: string; 
  includeToc?: boolean;
  includeCover?: boolean;
  customTheme?: any;
  colorSequence?: string[];
  isExam?: boolean;
}) => {
  return (
    <Document title="Document Export" author="System">
      {includeCover ? (
        <Page size="A4" style={{ backgroundColor: '#ffffff', position: 'relative' }}>
          {/* Grid background approximation */}
          <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
            <Rect x="0" y="0" width="595" height="842" fill="#ffff00" />
            {Array.from({ length: 42 }).map((_, i) => (
              <Line key={`h${i}`} x1="0" y1={i * 20} x2="595" y2={i * 20} stroke="#d5d500" strokeWidth="1" />
            ))}
            {Array.from({ length: 30 }).map((_, i) => (
              <Line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="842" stroke="#d5d500" strokeWidth="1" />
            ))}
            {/* Some random geometric shapes */}
            <Rect x="50" y="700" width="100" height="100" fill="#000000" />
            <Circle cx="500" cy="150" r="60" fill="#0000ff" />
          </Svg>
          
          <View style={{ flex: 1, padding: 40, justifyContent: 'center' }}>
            <View style={{ backgroundColor: '#ffffff', padding: 40, borderWidth: 6, borderColor: '#000000', borderBottomWidth: 16, borderRightWidth: 16 }}>
              <Text style={{ fontSize: 16, color: '#ffffff', backgroundColor: '#ff0000', padding: 8, alignSelf: 'flex-start', fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', marginBottom: 24 }}>
                {isExam ? 'ASSESSMENT' : 'DOCUMENT'}
              </Text>
              <Text style={{ fontSize: 48, color: '#000000', fontFamily: 'Space Grotesk', fontWeight: 700, lineHeight: 1, letterSpacing: -2, marginBottom: 24, textTransform: 'uppercase' }}>
                {documents.length > 0 ? documents[0].title : 'UNTITLED'}
              </Text>
              {(documents[0] as any)?.metadata?.description ? (
                <Text style={{ fontSize: 14, color: '#000000', fontFamily: 'Space Mono', lineHeight: 1.4, backgroundColor: '#eeeeee', padding: 12, borderWidth: 2, borderColor: '#000000' }}>
                  {(documents[0] as any).metadata.description}
                </Text>
              ) : <View />}
            </View>
          </View>
        </Page>
      ) : <View />}

      {includeToc && documents.length > 1 ? <BrutalistTableOfContents documents={documents} docColors={{}} /> : <View />}

      {documents.map((doc, dIdx) => (
        <Page key={dIdx} size="A4" style={{ backgroundColor: '#ffffff', padding: 40, paddingBottom: 80, position: 'relative' }}>
          {/* Light Grid background approximation for pages too */}
          <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
            {Array.from({ length: 42 }).map((_, i) => (
              <Line key={`h${i}`} x1="0" y1={i * 20} x2="595" y2={i * 20} stroke="#f0f0f0" strokeWidth="1" />
            ))}
            {Array.from({ length: 30 }).map((_, i) => (
              <Line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="842" stroke="#f0f0f0" strokeWidth="1" />
            ))}
          </Svg>

          <View style={{ marginBottom: 40, backgroundColor: '#000000', padding: 16 }}>
            <Text style={{ fontSize: 12, color: '#00ff00', fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
              SECTION {String((dIdx + 1)).padStart(2, '0')}
            </Text>
            <Text style={{ fontSize: 32, color: '#ffffff', fontFamily: 'Space Grotesk', fontWeight: 700, letterSpacing: -1, textTransform: 'uppercase' }}>
              {doc.title}
            </Text>
          </View>

          {doc.blocks.map((block, bIdx) => (
            <BrutalistBlockRenderer key={bIdx} block={block} docColors={{}} isExam={isExam} />
          ))}

          {/* Footer */}
          <View fixed style={{ position: 'absolute', bottom: 40, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 4, borderTopColor: '#000000', paddingTop: 16 }}>
             <Text style={{ fontSize: 10, color: '#000000', fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase' }}>{doc.title}</Text>
             <Text style={{ fontSize: 12, color: '#ffffff', backgroundColor: '#000000', padding: '4px 8px', fontFamily: 'Space Grotesk', fontWeight: 700 }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
};

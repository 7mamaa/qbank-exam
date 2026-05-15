import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Line, Circle, Rect, Polygon, Font } from '@react-pdf/renderer';

// Register Inter for reading text
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', fontWeight: 700 }
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
const getFontFamily = (text: string, defaultFont = 'Inter') => isArabic(text) ? 'Cairo' : defaultFont;
const getTitleFontFamily = (text: string) => isArabic(text) ? 'Cairo' : 'Inter';

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

const ModernRichText = ({ text, baseStyle }: { text: string; baseStyle: any }): any => {
  if (!text) return <Text style={baseStyle}>{" "}</Text>;
  const processed = prepareInteractiveSyntax(text);
  const parts = processed.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|==.*?==|@@[^@]+@@)/g);

  if (parts.length === 1 && !processed.match(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|`.*?`|==.*?==|@@[^@]+@@)/)) {
    return <Text style={{ ...baseStyle, fontFamily: getFontFamily(processed, baseStyle.fontFamily) }}>{processed}</Text>;
  }

  return (
    <Text style={baseStyle}>
      {parts.filter(Boolean).map((part, i) => {
        let style: any = {
          ...baseStyle,
          fontWeight: baseStyle?.fontWeight || 400,
          color: baseStyle?.color || '#334155',
          fontFamily: getFontFamily(part, baseStyle?.fontFamily)
        };

        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
          const content = part.slice(2, -2);
          return <ModernRichText key={i} text={content} baseStyle={{ ...style, fontWeight: 700, color: '#0f172a' }} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <ModernRichText key={i} text={content} baseStyle={{ ...style, color: '#64748b' }} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          return <ModernRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: '#fef08a', color: '#854d0e', padding: '1px 4px', borderRadius: 2 }} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = '#db2777';
          style.fontFamily = isArabic(content) ? 'Cairo' : 'Courier';
          style.backgroundColor = '#fce7f3';
          return <Text key={i} style={style}>{content}</Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.fontWeight = 700;
          style.color = '#059669';
          return <Text key={i} style={style}>{`[Photo: ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

const ModernBlockRenderer = ({ block, docColors, isExam }: { block: PdfBlock, docColors: any, isExam: boolean }) => {
  if (!block) return <View />;
  const content = block.content || '';
  const isRtl = isArabic(prepareInteractiveSyntax(content));

  switch (block.type) {
    case 'heading':
      return (
        <View wrap={false} style={{ marginBottom: 24, marginTop: 32, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* A subtle geometric vertical bar to indicate a heading */}
            <View style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: docColors.main, marginRight: isRtl ? 0 : 12, marginLeft: isRtl ? 12 : 0 }} />
            <ModernRichText text={content} baseStyle={{ fontSize: 22, fontFamily: getTitleFontFamily(content), fontWeight: 700, color: '#0f172a', lineHeight: 1.3, letterSpacing: -0.5 }} />
          </View>
        </View>
      );
    case 'subheading':
      return (
        <View wrap={false} style={{ marginTop: 20, marginBottom: 12, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
          <ModernRichText text={content} baseStyle={{ fontSize: 16, fontFamily: getTitleFontFamily(content), fontWeight: 700, color: '#1e293b', textAlign: isRtl ? 'right' : 'left', letterSpacing: -0.2 }} />
        </View>
      );
    case 'subtitle':
      return (
        <View wrap={false} style={{ marginTop: 16, marginBottom: 8, alignSelf: isRtl ? 'flex-end' : 'flex-start' }}>
          <ModernRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Inter', fontWeight: 500, color: docColors.main, textAlign: isRtl ? 'right' : 'left', letterSpacing: 0.5, textTransform: 'uppercase' }} />
        </View>
      );
    case 'paragraph':
    case 'text':
    case 'plain':
      if (content.trim() === '') return <View style={{ height: 10 }} />;
      return (
        <View style={{ marginBottom: 14 }}>
          <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', lineHeight: 1.6, color: '#334155', textAlign: isRtl ? 'right' : 'left' }} />
        </View>
      );
    case 'example': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: '#fcfcfc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#94a3b8' }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: '#64748b', fontFamily: 'Inter', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Example</Text>
              <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#1e293b', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'explanation': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: '#f8fafc', borderRadius: 12 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: docColors.main, fontFamily: 'Inter', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Explanation</Text>
              <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#334155', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'note': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: docColors.bgLight, borderRadius: 12 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 10, color: docColors.dark, fontFamily: 'Inter', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Note</Text>
              <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: docColors.dark, lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'warning': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 10, color: '#ef4444', fontFamily: 'Inter', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Warning</Text>
              <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#7f1d1d', fontWeight: 500, lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'tip': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fef08a', borderRadius: 12 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
               <Text style={{ fontSize: 10, color: '#eab308', fontFamily: 'Inter', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pro Tip</Text>
              <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#854d0e', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'high_yield': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: '#ffffff', borderWidth: 2, borderColor: docColors.main, borderRadius: 16, position: 'relative' }}>
          <View style={{ position: 'absolute', top: -10, left: 20, backgroundColor: '#ffffff', paddingHorizontal: 8 }}>
            <Text style={{ color: docColors.main, fontSize: 10, fontWeight: 700, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 1 }}>High Yield</Text>
          </View>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, justifyContent: 'center', marginTop: 8 }}>
              <ModernRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Inter', color: '#0f172a', fontWeight: 500, lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} />
            </View>
          </View>
        </View>
      );
    }
    case 'clinical_correlation': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ fontSize: 10, color: '#059669', fontFamily: 'Inter', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Clinical Correlation</Text>
              <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#065f46', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} />
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
              <View wrap={false} key={i} style={{ flexDirection: isItemRtl ? 'row-reverse' : 'row', marginBottom: 8, alignItems: 'flex-start' }}>
                <View style={{ width: 24, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 }}>
                  {isOrdered ? (
                    <Text style={{ fontSize: 11, fontWeight: 500, color: '#64748b', fontFamily: 'Inter' }}>{i + 1}.</Text>
                  ) : (
                    <Svg width="4" height="4" viewBox="0 0 4 4" style={{ marginTop: 3 }}>
                      <Circle cx="2" cy="2" r="2" fill="#94a3b8" />
                    </Svg>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: isItemRtl ? 0 : 8, marginRight: isItemRtl ? 8 : 0 }}>
                  <ModernRichText text={item} baseStyle={{ fontSize: 11, fontFamily: 'Inter', lineHeight: 1.6, color: '#334155', textAlign: isItemRtl ? 'right' : 'left' }} />
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
              <View wrap={false} key={i} style={{ flexDirection: isItemRtl ? 'row-reverse' : 'row', backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center' }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: docColors.main, justifyContent: 'center', alignItems: 'center', marginLeft: isItemRtl ? 16 : 0, marginRight: isItemRtl ? 0 : 16 }}>
                  <Text style={{ color: '#ffffff', fontWeight: 700, fontSize: 12, fontFamily: 'Inter' }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <ModernRichText text={item} baseStyle={{ fontSize: 11, fontFamily: 'Inter', lineHeight: 1.5, color: '#1e293b', textAlign: isItemRtl ? 'right' : 'left' }} />
                </View>
              </View>
            );
          })}
        </View>
      );
    case 'quote':
      const isQuoteRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 24, paddingLeft: isQuoteRtl ? 0 : 20, paddingRight: isQuoteRtl ? 20 : 0, borderLeftWidth: isQuoteRtl ? 0 : 2, borderRightWidth: isQuoteRtl ? 2 : 0, borderColor: docColors.main }}>
          <ModernRichText text={content} baseStyle={{ fontSize: 14, fontFamily: 'Inter', fontStyle: 'italic', color: '#475569', textAlign: isQuoteRtl ? 'right' : 'left', lineHeight: 1.6 }} />
        </View>
      );
    case 'vocabulary':
      const vocabIsRtl = isArabic(prepareInteractiveSyntax(block.term || '') + prepareInteractiveSyntax(block.definition || ''));
      return (
        <View wrap={false} style={{ marginVertical: 12, flexDirection: vocabIsRtl ? 'row-reverse' : 'row', alignItems: 'stretch', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' }}>
          <View style={{ width: '30%', backgroundColor: '#f8fafc', padding: 16, justifyContent: 'center', alignItems: vocabIsRtl ? 'flex-end' : 'flex-start', borderRightWidth: vocabIsRtl ? 0 : 1, borderLeftWidth: vocabIsRtl ? 1 : 0, borderColor: '#e2e8f0' }}>
            <ModernRichText text={block.term || ''} baseStyle={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 12, color: '#0f172a', textAlign: vocabIsRtl ? 'right' : 'left' }} />
          </View>
          <View style={{ width: '70%', backgroundColor: '#ffffff', padding: 16, justifyContent: 'center' }}>
            <ModernRichText text={block.definition || ''} baseStyle={{ fontFamily: 'Inter', fontSize: 11, lineHeight: 1.6, color: '#475569', textAlign: vocabIsRtl ? 'right' : 'left' }} />
          </View>
        </View>
      );
    case 'code':
      return (
        <View wrap={false} style={{ marginVertical: 16, backgroundColor: '#0f172a', borderRadius: 12, padding: 16 }}>
          <Text style={{ fontFamily: 'Courier', fontSize: 10, color: '#f8fafc', lineHeight: 1.6 }}>
            {content}
          </Text>
        </View>
      );
    case 'summary':
      return (
        <View wrap={false} style={{ marginVertical: 24, padding: 24, backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <Text style={{ fontSize: 12, color: '#0f172a', fontFamily: getTitleFontFamily(content), fontWeight: 700, marginBottom: 12, letterSpacing: -0.2 }}>Summary</Text>
          <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#334155', lineHeight: 1.6 }} />
        </View>
      );
    case 'reference':
      return (
        <View wrap={false} style={{ marginVertical: 8, paddingLeft: 12 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Inter', color: '#94a3b8' }}>
            Ref: {content}
          </Text>
        </View>
      );
    case 'dialogue':
      return (
        <View wrap={false} style={{ marginVertical: 12, padding: 16, backgroundColor: '#f1f5f9', borderRadius: 16, alignSelf: 'flex-start', maxWidth: '80%' }}>
          <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#1e293b', lineHeight: 1.5 }} />
        </View>
      );
    case 'flashcard': {
      const frontContent = block.front || content || 'Flashcard';
      const backContent = block.back || '';
      const isCardRtl = isArabic(prepareInteractiveSyntax(frontContent + backContent));
      return (
        <View wrap={false} style={{ marginVertical: 24, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <View style={{ padding: 24, paddingBottom: 16, alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontFamily: 'Inter', fontWeight: 500 }}>Flashcard Front</Text>
            <ModernRichText text={frontContent} baseStyle={{ fontSize: 14, fontFamily: 'Inter', color: '#0f172a', textAlign: 'center', fontWeight: 500, lineHeight: 1.5 }} />
          </View>
          {backContent ? (
            <View style={{ padding: 24, paddingTop: 16, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderColor: '#f1f5f9' }}>
               <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontFamily: 'Inter', fontWeight: 500 }}>Flashcard Back</Text>
              <ModernRichText text={backContent} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#475569', textAlign: isCardRtl ? 'right' : 'center', lineHeight: 1.6 }} />
            </View>
          ) : []}
        </View>
      );
    }
    case 'caption':
      return (
        <View wrap={false} style={{ marginTop: 8, marginBottom: 16, alignItems: 'center' }}>
          <ModernRichText text={content} baseStyle={{ fontSize: 9, fontFamily: 'Inter', color: '#64748b', textAlign: 'center' }} />
        </View>
      );
    case 'horizontal_rule':
      return <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 32 }} />;
    case 'page_break':
      return <View break />;
    case 'essay_area':
      return (
        <View wrap={false} style={{ marginVertical: 24 }}>
          <Text style={{ fontSize: 11, color: '#0f172a', fontFamily: 'Inter', fontWeight: 500, marginBottom: 12 }}>{content || "Notes"}</Text>
          <View style={{ height: 200, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 }}>
             {/* Lines for writing */}
             {Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={{ height: 1, backgroundColor: '#cbd5e1', marginTop: Math.max(18, (200 - 32) / 8) }} />
             ))}
          </View>
        </View>
      );
    case 'bento':
    case 'expandable':
    case 'reveal':
    case 'container':
      return (
        <View wrap={false} style={{ marginVertical: 24, padding: 24, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' }}>
          <View style={{ flexDirection: 'column' }}>
            {block.blocks?.map((child, idx) => (
              <View key={idx} style={{ marginBottom: idx === block.blocks!.length - 1 ? 0 : 16 }}>
                 <ModernBlockRenderer block={child} docColors={docColors} isExam={isExam} />
              </View>
            ))}
          </View>
        </View>
      );
    case 'table':
      return (
        <View wrap={false} style={{ marginVertical: 24, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' }}>
          {block.columns && block.columns.length > 0 ? (
            <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
              {block.columns.map((col, cIdx) => (
                <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4 }}>
                  <ModernRichText text={col} baseStyle={{ fontSize: 10, fontWeight: 500, color: '#64748b', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 0.5 }} />
                </View>
              ))}
            </View>
          ) : []}
          <View style={{ flexDirection: 'column' }}>
            {(block.rows || []).map((row, rIdx) => (
              <View key={rIdx} style={{ flexDirection: 'row', backgroundColor: '#ffffff', padding: 16, borderBottomWidth: rIdx === block.rows!.length - 1 ? 0 : 1, borderColor: '#f1f5f9' }}>
                {row.map((cell, cIdx) => (
                  <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4 }}>
                    <ModernRichText text={cell} baseStyle={{ fontSize: 11, color: '#334155', fontFamily: 'Inter', lineHeight: 1.5 }} />
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
          <View style={{ borderRadius: 16, overflow: 'hidden' }}>
            <Image src={block.imageUrl || ''} style={{ width: 480, height: 'auto', objectFit: 'cover' }} />
          </View>
          {block.imageCaption ? (
            <View style={{ marginTop: 12, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 10, color: '#64748b', fontFamily: 'Inter' }}>{block.imageCaption}</Text>
            </View>
          ) : <View />}
        </View>
      );
    default:
      return (
        <View style={{ marginBottom: 8 }}>
          <ModernRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#334155' }} />
        </View>
      );
  }
};

// Table of Contents for Modern
const ModernTableOfContents = ({ documents, docColors }: { documents: PdfDocument[], docColors: any }) => {
  const tocItems: { title: string; page: number }[] = [];
  let currentPage = 2; // Cover is 1, TOC is 2

  documents.forEach((doc, idx) => {
    tocItems.push({ title: doc.title || `Document ${idx + 1}`, page: currentPage });
    const blocksCount = doc.blocks.length;
    currentPage += Math.ceil(blocksCount / 5) || 1; 
  });

  return (
    <Page size="A4" style={{ backgroundColor: '#ffffff', padding: 60, position: 'relative' }}>
      <View style={{ marginBottom: 40, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 16 }}>
        <Text style={{ fontSize: 12, fontFamily: 'Inter', fontWeight: 500, color: docColors.main, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Contents</Text>
        <Text style={{ fontSize: 24, fontFamily: 'Inter', fontWeight: 700, color: '#0f172a', letterSpacing: -0.5 }}>Table of Contents</Text>
      </View>

      <View>
        {tocItems.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            <Text style={{ fontSize: 13, color: '#334155', fontWeight: 500, fontFamily: 'Inter' }}>{prepareInteractiveSyntax(item.title)}</Text>
            <View style={{ flex: 1, marginHorizontal: 16 }} />
            <Text style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', fontFamily: 'Inter' }}>{String(i + (tocItems.length > 0 ? 3 : 2)).padStart(2, '0')}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
};

export const ReactPdfOutputModern = ({ 
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
  const getColorsForDoc = () => {
    if (themeColor && themeColor.startsWith('custom-')) {
      return { main: '#4f46e5', light: '#c7d2fe', dark: '#1e1b4b', bgLight: '#e0e7ff' };
    }
    const colorMap: Record<string, { main: string, light: string, dark: string, bgLight: string }> = {
      indigo: { main: "#6366f1", light: "#e0e7ff", dark: "#312e81", bgLight: "#f5f3ff" },
      emerald: { main: "#10b981", light: "#d1fae5", dark: "#064e3b", bgLight: "#ecfdf5" },
      rose: { main: "#f43f5e", light: "#ffe4e6", dark: "#881337", bgLight: "#fff1f2" },
      amber: { main: "#f59e0b", light: "#fef3c7", dark: "#78350f", bgLight: "#fffbeb" },
      violet: { main: "#8b5cf6", light: "#ede9fe", dark: "#4c1d95", bgLight: "#f5f3ff" },
      cyan: { main: "#06b6d4", light: "#cffafe", dark: "#164e63", bgLight: "#ecfeff" },
    };
    return colorMap[themeColor] || { main: "#6366f1", light: "#e0e7ff", dark: "#312e81", bgLight: "#f5f3ff" };
  };

  const tColors = getColorsForDoc();

  return (
    <Document title="Document Export" author="System">
      {includeCover ? (
        <Page size="A4" style={{ backgroundColor: '#f8fafc', position: 'relative' }}>
          {/* subtle abstract shapes */}
          <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
            <Rect x="0" y="0" width="595" height="842" fill="#fafafa" />
            
            {/* Modern Minimalist Shapes */}
            <Circle cx="500" cy="100" r="150" fill={tColors.light} fillOpacity="0.4" />
            <Circle cx="100" cy="750" r="200" fill={tColors.bgLight} fillOpacity="0.8" />
            <Rect x="450" y="600" width="80" height="80" fill={tColors.light} fillOpacity="0.3" rx="20" ry="20" />
            <Polygon points="50,200 100,100 150,200" fill={tColors.bgLight} fillOpacity="0.5" />
          </Svg>
          
          <View style={{ flex: 1, padding: 60, justifyContent: 'center' }}>
            <View style={{ backgroundColor: '#ffffff', padding: 48, borderRadius: 24 }}>
              <View style={{ width: 48, height: 4, backgroundColor: tColors.main, borderRadius: 2, marginBottom: 24 }} />
              <Text style={{ fontSize: 11, color: tColors.main, fontFamily: 'Inter', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
                {isExam ? 'Assessment' : 'Document Module'}
              </Text>
              <Text style={{ fontSize: 36, color: '#0f172a', fontFamily: 'Inter', fontWeight: 700, lineHeight: 1.2, letterSpacing: -1, marginBottom: 24 }}>
                {documents.length > 0 ? documents[0].title : 'Untitled Document'}
              </Text>
              {(documents[0] as any)?.metadata?.description ? (
                <Text style={{ fontSize: 13, color: '#475569', fontFamily: 'Inter', lineHeight: 1.6 }}>
                  {(documents[0] as any).metadata.description}
                </Text>
              ) : <View />}
            </View>
          </View>
        </Page>
      ) : <View />}

      {includeToc && documents.length > 1 ? <ModernTableOfContents documents={documents} docColors={tColors} /> : <View />}

      {documents.map((doc, dIdx) => (
        <Page key={dIdx} size="A4" style={{ backgroundColor: '#ffffff', padding: 60, paddingBottom: 80, position: 'relative' }}>
          <View style={{ marginBottom: 40 }}>
            <Text style={{ fontSize: 10, color: tColors.main, fontFamily: 'Inter', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Section {String((dIdx + 1)).padStart(2, '0')}
            </Text>
            <Text style={{ fontSize: 24, color: '#0f172a', fontFamily: 'Inter', fontWeight: 700, letterSpacing: -0.5, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              {doc.title}
            </Text>
          </View>

          {doc.blocks.map((block, bIdx) => (
            <ModernBlockRenderer key={bIdx} block={block} docColors={tColors} isExam={isExam} />
          ))}

          {/* Footer */}
          <View fixed style={{ position: 'absolute', bottom: 40, left: 60, right: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
             <Text style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'Inter', fontWeight: 500 }}>{doc.title}</Text>
             <Text style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'Inter', fontWeight: 500 }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
};

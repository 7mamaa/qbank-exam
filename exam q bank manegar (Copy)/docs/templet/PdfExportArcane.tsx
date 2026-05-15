import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Line, Circle, Rect, Polygon, Ellipse, Font, Defs, LinearGradient, Stop, G } from '@react-pdf/renderer';
import { THEMES } from '../../constants/themes';

// Register Inter for body text
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

const ArcaneRichText = ({ text, baseStyle, docColors }: { text: string; baseStyle: any; docColors?: any }): any => {
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
          color: baseStyle?.color || '#cbd5e1', 
          fontFamily: getFontFamily(part, baseStyle?.fontFamily)
        };

        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
          const content = part.slice(2, -2);
          return <ArcaneRichText key={i} text={content} baseStyle={{ ...style, fontWeight: 700, color: '#f8fafc' }} docColors={docColors} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <ArcaneRichText key={i} text={content} baseStyle={{ ...style, color: '#94a3b8' }} docColors={docColors} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          // Highlight with Hextech blue glow
          return <ArcaneRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: docColors?.bgLight || 'rgba(56, 189, 248, 0.15)', color: docColors?.neon || '#38bdf8', paddingVertical: 1, paddingHorizontal: 4, borderRadius: 2 }} docColors={docColors} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = docColors?.neon || '#38bdf8'; // Hextech neon
          style.fontFamily = isArabic(content) ? 'Cairo' : 'Courier';
          style.backgroundColor = docColors?.bgLight || 'rgba(56, 189, 248, 0.1)';
          return <Text key={i} style={style}>{content}</Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.fontWeight = 700;
          style.color = '#eab308'; // Gold for photos
          return <Text key={i} style={style}>{`[Photo: ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

const ArcaneBlockRenderer = ({ block, docColors, isExam }: { block: PdfBlock, docColors: any, isExam: boolean }) => {
  if (!block) return <View />;
  const content = block.content || '';
  const isRtl = isArabic(prepareInteractiveSyntax(content));

  switch (block.type) {
    case 'heading':
      return (
        <View wrap={false} style={{ marginBottom: 24, marginTop: 32, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: docColors.neon, paddingBottom: 8, position: 'relative' }}>
            <ArcaneRichText text={content} baseStyle={{ fontSize: 24, fontFamily: 'Inter', fontWeight: 700, color: docColors.gold, lineHeight: 1.3, letterSpacing: 1 }} docColors={docColors} />
            <View style={{ position: 'absolute', bottom: -3, right: isRtl ? undefined : 0, left: isRtl ? 0 : undefined, width: 6, height: 6, borderRadius: 3, backgroundColor: docColors.neon, opacity: 0.8 }} />
          </View>
        </View>
      );
    case 'subheading':
      return (
        <View wrap={false} style={{ marginTop: 24, marginBottom: 12, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: docColors.bgDarkest, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: docColors.gold, borderRightWidth: 1, borderRightColor: docColors.border }}>
            <ArcaneRichText text={content} baseStyle={{ fontSize: 16, fontFamily: 'Inter', fontWeight: 700, color: '#f8fafc', textAlign: isRtl ? 'right' : 'left', letterSpacing: 0.5 }} docColors={docColors} />
          </View>
        </View>
      );
    case 'subtitle':
      return (
        <View wrap={false} style={{ marginTop: 16, marginBottom: 8, alignSelf: isRtl ? 'flex-end' : 'flex-start' }}>
          <ArcaneRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', fontWeight: 500, color: docColors.neon, textAlign: isRtl ? 'right' : 'left', letterSpacing: 1.5, textTransform: 'uppercase' }} docColors={docColors} />
        </View>
      );
    case 'paragraph':
    case 'text':
    case 'plain':
      if (content.trim() === '') return <View style={{ height: 10 }} />;
      return (
        <View style={{ marginBottom: 14 }}>
           <ArcaneRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', lineHeight: 1.8, color: '#cbd5e1', textAlign: isRtl ? 'right' : 'left' }} docColors={docColors} />
        </View>
      );
    case 'example': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: docColors.bgDark, borderStyle: 'solid', borderWidth: 1, borderColor: docColors.neon, position: 'relative' }}>
          <View style={{ position: 'absolute', top: 0, left: 0, width: 15, height: 15, borderTopWidth: 3, borderLeftWidth: 3, borderColor: docColors.neon }} />
          <View style={{ position: 'absolute', bottom: 0, right: 0, width: 15, height: 15, borderBottomWidth: 3, borderRightWidth: 3, borderColor: docColors.neon }} />
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: docColors.neon, fontFamily: 'Inter', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>[ ACTIONABLE SECTOR: CASE STUDY ]</Text>
               <ArcaneRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#e2e8f0', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
            </View>
          </View>
        </View>
      );
    }
    case 'explanation': {
        const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
        return (
          <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: docColors.bgDark, borderRadius: 2, borderWidth: 1, borderColor: docColors.gold, borderStyle: 'solid', position: 'relative', borderLeftWidth: 8, borderLeftColor: docColors.neon }}>
             <View style={{ position: 'absolute', top: -6, right: 10, width: 12, height: 12, borderRadius: 6, backgroundColor: docColors.neon }} />
            <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: docColors.gold, fontFamily: 'Inter', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>// CORE LOGIC PROTOCOL</Text>
                 <ArcaneRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#cbd5e1', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
              </View>
            </View>
          </View>
        );
      }
    case 'note': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: docColors.bgDarkest, borderRadius: 0, borderWidth: 0, borderLeftWidth: 4, borderLeftColor: docColors.neon, borderTopWidth: 1, borderTopColor: docColors.neonMuted }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: docColors.neon, fontFamily: 'Inter', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>Index Analysis</Text>
               <ArcaneRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#cbd5e1', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
            </View>
          </View>
        </View>
      );
    }
    case 'warning': {
        const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
        return (
          <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: 'rgba(69, 10, 10, 0.5)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 4 }}>
            <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
               <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, color: '#f87171', fontFamily: 'Inter', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Critical</Text>
                 <ArcaneRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#fecaca', fontWeight: 500, lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} />
              </View>
            </View>
          </View>
        );
      }
    case 'tip': {
        const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
        return (
          <View wrap={false} style={{ marginVertical: 16, padding: 20, backgroundColor: 'rgba(21, 128, 61, 0.2)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 4 }}>
            <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
               <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, color: '#4ade80', fontFamily: 'Inter', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Pro Tip</Text>
                 <ArcaneRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#bbf7d0', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
              </View>
            </View>
          </View>
        );
      }
    case 'high_yield': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 24, backgroundColor: docColors.bgDark, borderWidth: 2, borderColor: docColors.gold, borderRadius: 0, position: 'relative' }}>
          <View style={{ position: 'absolute', top: -10, left: 24, backgroundColor: docColors.bgDarkest, paddingHorizontal: 8, borderWidth: 1, borderColor: docColors.gold }}>
             <Text style={{ color: docColors.gold, fontSize: 10, fontWeight: 700, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 2 }}>High Yield Objective</Text>
          </View>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, marginTop: 4 }}>
               <ArcaneRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Inter', color: '#f8fafc', fontWeight: 500, lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
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
              <View wrap={false} key={i} style={{ flexDirection: isItemRtl ? 'row-reverse' : 'row', marginBottom: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 24, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 }}>
                  {isOrdered ? (
                    <Text style={{ fontSize: 11, fontWeight: 700, color: docColors.neon, fontFamily: 'Courier' }}>0{i + 1}</Text>
                  ) : (
                    <View style={{ width: 6, height: 6, backgroundColor: 'transparent', borderWidth: 1, borderColor: docColors.gold, transform: 'rotate(45deg)', marginTop: 4 }}>
                        <View style={{ width: 2, height: 2, margin: 1, backgroundColor: docColors.neon }} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: isItemRtl ? 0 : 8, marginRight: isItemRtl ? 8 : 0 }}>
                   <ArcaneRichText text={item} baseStyle={{ fontSize: 11, fontFamily: 'Inter', lineHeight: 1.6, color: '#cbd5e1', textAlign: isItemRtl ? 'right' : 'left' }} docColors={docColors} />
                </View>
              </View>
            );
          })}
        </View>
      );
    case 'quote':
      const isQuoteRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 24, padding: 24, backgroundColor: docColors.bgDarkest, borderWidth: 1, borderColor: docColors.border, borderLeftWidth: 4, borderLeftColor: docColors.gold }}>
          <View style={{ flexDirection: isQuoteRtl ? 'row-reverse' : 'row' }}>
             <Text style={{ fontSize: 40, fontFamily: 'Inter', color: docColors.gold, opacity: 0.5, marginTop: -10 }}>&quot;</Text>
             <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10 }}>
                <ArcaneRichText text={content} baseStyle={{ fontSize: 14, fontFamily: 'Inter', fontStyle: 'italic', color: '#e2e8f0', textAlign: isQuoteRtl ? 'right' : 'left', lineHeight: 1.8 }} docColors={docColors} />
             </View>
          </View>
        </View>
      );
    case 'code':
      return (
        <View wrap={false} style={{ marginVertical: 16, backgroundColor: docColors.bgDarkest, borderRadius: 4, padding: 16, borderWidth: 1, borderColor: docColors.neon }}>
          <Text style={{ fontFamily: 'Courier', fontSize: 10, color: docColors.neon, lineHeight: 1.6 }}>
            {content}
          </Text>
        </View>
      );
    case 'table':
        return (
          <View wrap={false} style={{ marginVertical: 24, borderRadius: 0, overflow: 'hidden', borderWidth: 1, borderColor: docColors.gold }}>
            {block.columns && block.columns.length > 0 ? (
              <View style={{ flexDirection: 'row', backgroundColor: docColors.bgLight, padding: 16, borderBottomWidth: 1, borderBottomColor: docColors.gold }}>
                {block.columns.map((col, cIdx) => (
                  <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4 }}>
                     <ArcaneRichText text={col} baseStyle={{ fontSize: 9, fontWeight: 700, color: docColors.gold, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 1 }} docColors={docColors} />
                  </View>
                ))}
              </View>
            ) : []}
            <View style={{ flexDirection: 'column' }}>
              {(block.rows || []).map((row, rIdx) => (
                <View key={rIdx} style={{ flexDirection: 'row', backgroundColor: rIdx % 2 === 0 ? docColors.bgDark : docColors.bgDarkest, padding: 16, borderBottomWidth: rIdx === block.rows!.length - 1 ? 0 : 1, borderColor: docColors.border }}>
                  {row.map((cell, cIdx) => (
                    <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4 }}>
                       <ArcaneRichText text={cell} baseStyle={{ fontSize: 11, color: '#cbd5e1', fontFamily: 'Inter', lineHeight: 1.5 }} docColors={docColors} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        );
    case 'image':
      if (!block.imageUrl) return <View />;
      return (
        <View wrap={false} style={{ marginVertical: 24, alignItems: 'center' }}>
          <View style={{ padding: 4, backgroundColor: docColors.bgDarkest, borderWidth: 2, borderColor: docColors.gold }}>
            <Image src={block.imageUrl} style={{ width: 480, height: 'auto', objectFit: 'cover', opacity: 0.9 }} />
          </View>
        </View>
      );
    case 'page_break':
      return <View break />;
    default:
      return (
        <View style={{ marginBottom: 8 }}>
           <ArcaneRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#cbd5e1' }} docColors={docColors} />
        </View>
      );
  }
};

const ArcaneTableOfContents = ({ documents, docColors }: { documents: PdfDocument[], docColors: any }) => {
  const tocItems: { title: string; page: number }[] = [];
  let currentPage = 2; // Cover is 1, TOC is 2

  documents.forEach((doc, idx) => {
    tocItems.push({ title: doc.title || `Document ${idx + 1}`, page: currentPage });
    const blocksCount = doc.blocks.length;
    currentPage += Math.ceil(blocksCount / 5) || 1; 
  });

  return (
    <Page size="A4" style={{ backgroundColor: docColors.bgDark || '#0f172a', padding: 60, position: 'relative' }}>
      <ArcaneBackgroundGraphics colors={docColors} />
      <View style={{ marginBottom: 60, alignItems: 'center' }}>
        <View style={{ position: 'relative', paddingHorizontal: 24, paddingVertical: 10 }}>
          <Text style={{ fontSize: 32, fontFamily: 'Inter', fontWeight: 700, color: docColors.gold, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 4 }}>Registry</Text>
          <View style={{ position: 'absolute', top: 0, left: 0, width: 8, height: 8, borderTopWidth: 2, borderLeftWidth: 2, borderColor: docColors.neon }} />
          <View style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderBottomWidth: 2, borderRightWidth: 2, borderColor: docColors.neon }} />
        </View>
        <View style={{ width: '100%', alignItems: 'center', marginTop: 15 }}>
          <Svg width="250" height="20" viewBox="0 0 250 20">
            <Line x1="0" y1="10" x2="100" y2="10" stroke={docColors.neon} strokeWidth="1.5" />
            <Polygon points="125,2 133,10 125,18 117,10" fill="none" stroke={docColors.gold} strokeWidth="2" />
            <Circle cx="125" cy="10" r="3" fill={docColors.neon} />
            <Line x1="150" y1="10" x2="250" y2="10" stroke={docColors.neon} strokeWidth="1.5" />
          </Svg>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {tocItems.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: `${docColors.neon}1A`, borderStyle: 'solid' }}>
             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <View style={{ width: 6, height: 6, backgroundColor: docColors.neon, transform: 'rotate(45deg)', marginRight: 12 }} />
               <Text style={{ fontSize: 14, color: '#f8fafc', fontWeight: 400, fontFamily: 'Inter' }}>{prepareInteractiveSyntax(item.title)}</Text>
             </View>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: `${docColors.neon}33`, marginHorizontal: 15, marginTop: 4, borderStyle: 'dashed' }} />
             <Text style={{ fontSize: 14, fontWeight: 700, color: docColors.gold, fontFamily: 'Courier' }}>IDX_{String(i + 1).padStart(2, '0')}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
};

const ArcaneBackgroundGraphics = ({ colors, isCover = false }: { colors: any, isCover?: boolean }) => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
    <Defs>
      <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.bgDarkest || "#020617"} />
        <Stop offset="0.5" stopColor={colors.bgDark || "#0f172a"} />
        <Stop offset="1" stopColor={colors.bgDarkest || "#020617"} />
      </LinearGradient>
      <LinearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.gold} stopOpacity="0.4" />
        <Stop offset="0.5" stopColor={colors.gold} stopOpacity="1" />
        <Stop offset="1" stopColor={colors.gold} stopOpacity="0.8" />
      </LinearGradient>
      <LinearGradient id="neonGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.neon} stopOpacity="0.8" />
        <Stop offset="1" stopColor={colors.neon} stopOpacity="0.2" />
      </LinearGradient>
      <LinearGradient id="manaFlow" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={colors.neon} stopOpacity="0" />
        <Stop offset="0.5" stopColor={colors.neon} stopOpacity="0.15" />
        <Stop offset="1" stopColor={colors.neon} stopOpacity="0" />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="595" height="842" fill="url('#bgGrad')" />
    
    {/* Subtle Theme Tint */}
    <Rect x="0" y="0" width="595" height="842" fill={colors.neon} opacity="0.02" />
    
    {/* Scanning Interlace - Thin horizontal lines across whole page */}
    <G opacity="0.12" stroke={colors.neon} strokeWidth="0.2">
      {[...Array(60)].map((_, i) => (
        <Line key={`scan-${i}`} x1="0" y1={i * 14} x2="595" y2={i * 14} />
      ))}
    </G>

    {/* Corner Circuitry Logic - More prominent accent color */}
    <G opacity="0.5" stroke={colors.neon} strokeWidth="1" fill="none">
      <Path d="M 15,15 L 60,15 L 60,60 M 30,15 L 30,40" />
      <Path d="M 580,15 L 535,15 L 535,60 M 565,15 L 565,40" />
      <Path d="M 15,827 L 60,827 L 60,782 M 30,827 L 30,802" />
      <Path d="M 580,827 L 535,827 L 535,782 M 565,827 L 565,802" />
    </G>

    <G opacity="0.4" stroke={colors.gold} strokeWidth="0.5" fill="none">
      <Path d="M 20,80 L 40,80 L 50,90 L 50,130" />
      <Path d="M 575,80 L 555,80 L 545,90 L 545,130" />
      <Path d="M 20,762 L 40,762 L 50,752 L 50,712" />
      <Path d="M 575,762 L 555,762 L 545,752 L 545,712" />
    </G>

    {/* Vector Field Dashed Lines */}
    <G opacity="0.05" stroke={colors.gold} strokeWidth="0.3" strokeDasharray="2,4">
      <Path d="M 0,300 Q 150,350 300,300 T 595,300" fill="none" />
      <Path d="M 0,542 Q 150,492 300,542 T 595,542" fill="none" />
    </G>

    {/* Micro-detailing: tiny dots in high-density clusters */}
    <G opacity="0.15" fill={colors.neon}>
      {[...Array(12)].map((_, i) => (
        <Circle key={`micro-dot-${i}`} cx={50 + Math.random() * 50} cy={100 + Math.random() * 50} r="0.8" />
      ))}
      {[...Array(12)].map((_, i) => (
        <Circle key={`micro-dot-r-${i}`} cx={500 + Math.random() * 50} cy={700 + Math.random() * 50} r="0.8" />
      ))}
    </G>

    {/* Steampunk grids */}
    <G opacity="0.1" stroke={colors.neon} strokeWidth="0.5">
      {[...Array(20)].map((_, i) => (
        <Line key={`h-${i}`} x1="0" y1={i * 45} x2="595" y2={i * 45} />
      ))}
      {[...Array(15)].map((_, i) => (
        <Line key={`v-${i}`} x1={i * 45} y1="0" x2={i * 45} y2="842" />
      ))}
    </G>

    {/* Ghost Hexagons - Layered Geometry */}
    <G opacity="0.05">
      <Polygon points="300,100 350,130 350,190 300,220 250,190 250,130" fill="none" stroke={colors.neon} strokeWidth="1" />
      <Polygon points="100,500 130,515 130,545 100,560 70,545 70,515" fill="none" stroke={colors.gold} strokeWidth="1" />
      <Polygon points="450,700 480,715 480,745 450,760 420,745 420,715" fill="none" stroke={colors.neon} strokeWidth="1" />
    </G>

    {/* Technical Scales - Varied & more detailed */}
    <G transform="translate(15, 60)">
      {[...Array(15)].map((_, i) => (
        <Line key={`tick-${i}`} x1="0" y1={i * 8} x2={i % 5 === 0 ? 12 : i % 2 === 0 ? 6 : 3} y2={i * 8} stroke={colors.gold} strokeWidth="0.5" opacity="0.4" />
      ))}
    </G>
    <G transform="translate(580, 600)">
      {[...Array(15)].map((_, i) => (
        <Line key={`tick-r-${i}`} x1="0" y1={i * 8} x2={i % 5 === 0 ? -12 : i % 2 === 0 ? -6 : -3} y2={i * 8} stroke={colors.neon} strokeWidth="0.5" opacity="0.4" />
      ))}
    </G>
    
    {/* Circuity Connection lines */}
    <G opacity="0.15">
      <Path d="M 0,200 L 100,200 L 150,250" fill="none" stroke={colors.neon} strokeWidth="0.5" />
      <Path d="M 595,200 L 495,200 L 445,150" fill="none" stroke={colors.gold} strokeWidth="0.5" />
      <Path d="M 0,600 L 50,600 L 100,650" fill="none" stroke={colors.gold} strokeWidth="0.5" />
    </G>

    {/* Network Nodes Grid */}
    <G opacity="0.2">
      <Circle cx="40" cy="40" r="1.5" fill={colors.neon} />
      <Circle cx="555" cy="40" r="1.5" fill={colors.neon} />
      <Circle cx="40" cy="802" r="1.5" fill={colors.neon} />
      <Circle cx="555" cy="802" r="1.5" fill={colors.neon} />
    </G>
    
    {/* Gears and circular tech elements */}
    <Circle cx="0" cy="0" r="200" fill="none" stroke="url('#goldGrad')" strokeWidth="2" opacity="0.3" strokeDasharray="10, 5" />
    <Circle cx="0" cy="0" r="180" fill="none" stroke={colors.neon} strokeWidth="1" opacity="0.4" />
    <Circle cx="0" cy="0" r="160" fill="none" stroke="url('#goldGrad')" strokeWidth="4" opacity="0.2" strokeDasharray="30, 20" />
    <Circle cx="0" cy="0" r="140" fill="none" stroke={colors.border} strokeWidth="0.5" opacity="0.5" />
    
    <Circle cx="595" cy="842" r="250" fill="none" stroke={colors.neon} strokeWidth="1" opacity="0.2" strokeDasharray="5,15" />
    <Circle cx="595" cy="842" r="220" fill="none" stroke="url('#goldGrad')" strokeWidth="2" opacity="0.3" />
    <Circle cx="595" cy="842" r="200" fill="none" stroke={colors.neon} strokeWidth="3" opacity="0.1" strokeDasharray="40, 10" />
    <Circle cx="595" cy="842" r="150" fill="none" stroke={colors.border} strokeWidth="0.5" opacity="0.4" />

    {/* Mana Flow - Aesthetic Curved Path */}
    <Path d="M -50,400 Q 150,200 300,400 T 645,400" fill="none" stroke="url('#manaFlow')" strokeWidth="80" opacity="0.3" />
    <Path d="M -50,450 Q 150,250 300,450 T 645,450" fill="none" stroke="url('#manaFlow')" strokeWidth="40" opacity="0.2" />

    {/* Data Matrix / Barcode-like clusters */}
    <G transform="translate(50, 25)" opacity="0.15">
      {[...Array(8)].map((_, i) => (
        <Rect key={`bar-${i}`} x={i * 4} y="0" width={i % 3 === 0 ? 3 : 1} height="8" fill={colors.neon} />
      ))}
    </G>
    <G transform="translate(500, 810)" opacity="0.15">
      {[...Array(6)].map((_, i) => (
        <Rect key={`bar-b-${i}`} x={i * 6} y="0" width="2" height={i % 2 === 0 ? 10 : 4} fill={colors.gold} />
      ))}
    </G>

    {/* Concentric Focal Circles */}
    <G opacity="0.1">
      <Circle cx="297.5" cy="421" r="300" fill="none" stroke={colors.neon} strokeWidth="0.5" />
      <Circle cx="297.5" cy="421" r="320" fill="none" stroke={colors.gold} strokeWidth="0.5" strokeDasharray="5, 10" />
      <Circle cx="297.5" cy="421" r="100" fill="none" stroke={colors.neon} strokeWidth="0.2" opacity="0.5" />
    </G>

        {/* Glyph Clusters - Decorative symbols with more accent color */}
    <G opacity="0.3" stroke={colors.neon} strokeWidth="0.8" fill="none">
       {/* Top left cluster */}
       <Path d="M 50,50 L 70,50 L 70,70 M 60,50 L 60,80" />
       <Circle cx="90" cy="60" r="4" stroke={colors.gold} />
       
       {/* Bottom right cluster */}
       <Path d="M 520,780 L 545,780 L 545,805 M 532,780 L 532,815" transform="translate(532, 792) rotate(180) translate(-532, -792)" />
       <Circle cx="485" cy="790" r="4" stroke={colors.gold} />
    </G>

    {/* Energy Conduits - More glowing branching paths with theme color */}
    <G opacity="0.3" stroke={colors.neon} strokeWidth="1" fill="none">
       <Path d="M 297.5,0 L 297.5,150 L 200,220 L 200,320" />
       <Path d="M 297.5,0 L 297.5,130 L 390,200 L 390,280" />
       <Path d="M 0,421 L 120,421 L 180,361" />
       <Path d="M 595,421 L 475,421 L 415,481" />
    </G>
    <G opacity="0.1" stroke={colors.neon} strokeWidth="3" fill="none">
       <Path d="M 297.5,0 L 297.5,150 L 200,220 L 200,320" />
       <Path d="M 595,421 L 475,421 L 415,481" />
    </G>

    {/* Technical Waves (Simulated Oscilloscope) */}
    <Path d="M 50,700 L 70,680 L 90,700 L 110,720 L 130,700" fill="none" stroke={colors.neon} strokeWidth="1.5" opacity="0.5" />
    <Path d="M 460,100 L 480,120 L 500,100 L 520,80 L 540,100" fill="none" stroke={colors.gold} strokeWidth="1" opacity="0.4" />
    
    <G opacity="0.2" stroke={colors.neon} strokeWidth="0.5">
      <Path d="M 50,150 L 80,150 L 100,170" fill="none" />
      <Path d="M 545,692 L 515,692 L 495,672" fill="none" />
    </G>

    {/* Node Grids (Technical Nodal points) */}
    <G opacity="0.2" fill={colors.neon}>
      {[...Array(5)].map((_, r) => [...Array(5)].map((_, c) => (
        <Circle key={`node-${r}-${c}`} cx={500 + c * 15} cy={700 + r * 15} r="1" />
      )))}
    </G>
    <G opacity="0.2" fill={colors.gold}>
      {[...Array(3)].map((_, r) => [...Array(8)].map((_, c) => (
        <Circle key={`node-t-${r}-${c}`} cx={100 + c * 10} cy={100 + r * 10} r="1" />
      )))}
    </G>

    {/* Floating Runes */}
    <G opacity="0.4">
      <Polygon points="550,100 565,100 557,115" fill="none" stroke={colors.gold} strokeWidth="0.5" />
      <Polygon points="50,750 65,750 57,765" fill="none" stroke={colors.neon} strokeWidth="0.5" />
      <Circle cx="557" cy="107" r="2" fill={colors.neon} opacity="0.5" />
      <Circle cx="57" cy="757" r="2" fill={colors.gold} opacity="0.5" />
    </G>

    {/* Frame lines inside */}
    <Rect x="20" y="20" width="555" height="802" fill="none" stroke="url('#goldGrad')" strokeWidth="3" opacity="0.6" />
    <Rect x="26" y="26" width="543" height="790" fill="none" stroke={colors.neon} strokeWidth="0.5" opacity="0.5" />
    <Rect x="30" y="30" width="535" height="782" fill="none" stroke={colors.border || colors.neon} strokeWidth="1" opacity="0.2" />
    
    {/* Corner bolted plates with extra detail */}
    {[ [20, 20], [575, 20], [20, 822], [575, 822] ].map(([cx, cy], i) => (
      <G key={`plate-${i}`}>
        <Rect x={cx < 300 ? 15 : 560} y={cy < 400 ? 15 : 807} width="20" height="20" fill={colors.bgDark || "#0f172a"} stroke="url('#goldGrad')" strokeWidth="1" opacity="0.8" />
        <Circle cx={cx < 300 ? 25 : 570} cy={cy < 400 ? 25 : 817} r="2" fill={colors.neon} opacity="0.9" />
        {/* Intricate circuitry lines from plates */}
        <Line 
          x1={cx < 300 ? 35 : 560} 
          y1={cy < 400 ? 25 : 817} 
          x2={cx < 300 ? 60 : 535} 
          y2={cy < 400 ? 25 : 817} 
          stroke={colors.neon} 
          strokeWidth="0.5" 
          opacity="0.3" 
        />
      </G>
    ))}

    {/* Hextech pipes layout - Complex Network */}
    <G opacity="0.3">
      <Path d="M 40,40 L 40,802" fill="none" stroke={colors.border} strokeWidth="1" />
      <Path d="M 555,40 L 555,802" fill="none" stroke={colors.border} strokeWidth="1" />
      <Path d="M 40,150 L 555,150" fill="none" stroke={colors.border} strokeWidth="0.5" strokeDasharray="2,5" />
      <Path d="M 40,692 L 555,692" fill="none" stroke={colors.border} strokeWidth="0.5" strokeDasharray="2,5" />
      
      {/* Pipe Junctions */}
      <Circle cx="40" cy="150" r="4" fill={colors.bgDark || "#0f172a"} stroke={colors.gold} strokeWidth="1" />
      <Circle cx="555" cy="150" r="4" fill={colors.bgDark || "#0f172a"} stroke={colors.gold} strokeWidth="1" />
      <Circle cx="40" cy="692" r="4" fill={colors.bgDark || "#0f172a"} stroke={colors.gold} strokeWidth="1" />
      <Circle cx="555" cy="692" r="4" fill={colors.bgDark || "#0f172a"} stroke={colors.gold} strokeWidth="1" />
    </G>

    {/* Big Hextech core for cover only */}
    {isCover && (
      <>
        <Circle cx="297.5" cy="360" r="220" fill="none" stroke="url('#goldGrad')" strokeWidth="1" opacity="0.15" />
        <Circle cx="297.5" cy="360" r="210" fill="none" stroke={colors.border} strokeWidth="0.5" opacity="0.2" />
        
        <Circle cx="297.5" cy="360" r="180" fill="none" stroke="url('#goldGrad')" strokeWidth="5" opacity="0.4" />
        <Circle cx="297.5" cy="360" r="160" fill="none" stroke={colors.neon} strokeWidth="2" opacity="0.6" strokeDasharray="10,30" />
        <Circle cx="297.5" cy="360" r="140" fill="none" stroke={colors.border} strokeWidth="1" opacity="0.3" />
        <Circle cx="297.5" cy="360" r="100" fill="url('#neonGrad')" opacity="0.1" />
        
        {/* Advanced Gear teeth - High Density */}
        {[...Array(24)].map((_, i) => (
           <Polygon
             key={`gear-outer-${i}`}
             points="287.5,140 307.5,140 317.5,155 277.5,155"
             fill="url('#goldGrad')"
             opacity="0.25"
             transform={`translate(297.5, 360) rotate(${i * 15}) translate(-297.5, -360)`}
           />
        ))}

        {/* Energy Orbits - Elliptical Paths */}
        <Ellipse cx="297.5" cy="360" rx="240" ry="120" fill="none" stroke={colors.neon} strokeWidth="0.5" opacity="0.3" transform="translate(297.5, 360) rotate(30) translate(-297.5, -360)" />
        <Ellipse cx="297.5" cy="360" rx="240" ry="120" fill="none" stroke={colors.gold} strokeWidth="0.5" opacity="0.2" transform="translate(297.5, 360) rotate(-30) translate(-297.5, -360)" />

        {[...Array(12)].map((_, i) => (
           <Polygon
             key={`gear-inner-${i}`}
             points="287.5,180 307.5,180 317.5,200 277.5,200"
             fill="url('#neonGrad')"
             opacity="0.4"
             transform={`translate(297.5, 360) rotate(${i * 30 + 15}) translate(-297.5, -360)`}
           />
        ))}

        {/* Inner geometric core - High Complexity */}
        <Polygon points="297.5,260 397.5,360 297.5,460 197.5,360" fill="none" stroke={colors.neon} strokeWidth="2" opacity="0.8" />
        <Polygon points="297.5,280 377.5,360 297.5,440 217.5,360" fill="none" stroke="url('#goldGrad')" strokeWidth="1" opacity="0.5" strokeDasharray="5,5" />
        
        <G transform="translate(297.5, 360) rotate(45) translate(-297.5, -360)">
          <Rect x="257.5" y="320" width="80" height="80" fill="none" stroke={colors.neon} strokeWidth="1" opacity="0.4" />
          <Rect x="267.5" y="330" width="60" height="60" fill="none" stroke={colors.gold} strokeWidth="1" opacity="0.4" />
        </G>
        
        <Circle cx="297.5" cy="360" r="15" fill={colors.neon} opacity="0.9" />
        <Circle cx="297.5" cy="360" r="30" fill="none" stroke={colors.gold} strokeWidth="2" opacity="0.8" strokeDasharray="4,4" />
        
        {/* Radial Energy Lines */}
        {[...Array(8)].map((_, i) => (
           <Line 
             key={`radial-${i}`}
             x1="297.5" y1="180" x2="297.5" y2="240" 
             stroke={colors.neon} 
             strokeWidth="1" 
             opacity="0.5" 
             transform={`translate(297.5, 360) rotate(${i * 45}) translate(-297.5, -360)`}
           />
        ))}

        {/* Energy orbits - Complex elliptical paths */}
        <Ellipse cx="297.5" cy="360" rx="260" ry="140" fill="none" stroke={colors.neon} strokeWidth="0.5" opacity="0.1" transform="translate(297.5, 360) rotate(60) translate(-297.5, -360)" />
        <Ellipse cx="297.5" cy="360" rx="260" ry="140" fill="none" stroke={colors.gold} strokeWidth="0.5" opacity="0.1" transform="translate(297.5, 360) rotate(-60) translate(-297.5, -360)" />

        {/* Intricate Energy Arcs */}
        <G opacity="0.3" stroke={colors.neon} strokeWidth="1" fill="none">
          <Path d="M 297.5,140 A 220,220 0 0 1 517.5,360" opacity="0.2" />
          <Path d="M 297.5,580 A 220,220 0 0 1 77.5,360" opacity="0.2" />
        </G>

        {/* Energy lines radiating across entire page */}
        <Line x1="297.5" y1="140" x2="297.5" y2="580" stroke={colors.neon} strokeWidth="0.5" opacity="0.3" />
        <Line x1="77.5" y1="360" x2="517.5" y2="360" stroke={colors.neon} strokeWidth="0.5" opacity="0.3" />
        
        {/* Additional Floating Nodes */}
        <G opacity="0.3">
          <Circle cx="297.5" cy="140" r="4" fill={colors.bgDark || "#0f172a"} stroke={colors.gold} strokeWidth="1" />
          <Circle cx="297.5" cy="580" r="4" fill={colors.bgDark || "#0f172a"} stroke={colors.gold} strokeWidth="1" />
          <Circle cx="77.5" cy="360" r="4" fill={colors.bgDark || "#0f172a"} stroke={colors.gold} strokeWidth="1" />
          <Circle cx="517.5" cy="360" r="4" fill={colors.bgDark || "#0f172a"} stroke={colors.gold} strokeWidth="1" />
        </G>
      </>
    )}
  </Svg>
);

export const ReactPdfOutputArcane = ({ 
  documents, 
  themeColor, 
  includeToc = true,
  includeCover = true,
  colorSequence = ['indigo'],
  isExam = false
}: { 
  documents: PdfDocument[]; 
  themeColor: string; 
  includeToc?: boolean;
  includeCover?: boolean;
  colorSequence?: string[];
  isExam?: boolean;
}) => {
  const parseColorToRgb = (color: string) => {
    let r = 0, g = 0, b = 0;
    const c = color.trim().toLowerCase();
    if (c.startsWith('#')) {
      let hex = c.replace(/^#/, '');
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length >= 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
    } else if (c.startsWith('rgb')) {
      const parts = c.match(/\d+/g);
      if (parts && parts.length >= 3) {
        r = parseInt(parts[0], 10);
        g = parseInt(parts[1], 10);
        b = parseInt(parts[2], 10);
      }
    } else if (c.startsWith('hsl')) {
      // Very rough fallback if somehow hsl is passed
      return { r: 14, g: 165, b: 233 };
    }
    return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
  };

  const adjustColor = (color: string, factor: number) => {
    const { r, g, b } = parseColorToRgb(color);
    return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
  };

  const adjustColorWithAlpha = (color: string, factor: number, alpha: number) => {
    const { r, g, b } = parseColorToRgb(color);
    return `rgba(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)}, ${alpha})`;
  };

  const getColorsForDoc = (groupName?: string) => {
    const groupsOrder = Array.from(new Set(documents.map(d => d.group || "Ungrouped")));
    const gIdx = groupsOrder.indexOf(groupName || "Ungrouped");
    const colorNameRaw = colorSequence[gIdx % colorSequence.length] || themeColor || 'sky';
    let colorName = colorNameRaw;
    if (colorName.startsWith('custom-')) {
      colorName = '#' + colorName.replace('custom-', '');
    }
    
    // Map theme colors to Arcane Neon/Gold pairs
    const arcanePairs: Record<string, { gold: string, neon: string }> = {
      indigo: { gold: "#fbbf24", neon: "#818cf8" },
      blue: { gold: "#fbbf24", neon: "#38bdf8" },
      sky: { gold: "#fbbf24", neon: "#0ea5e9" },
      cyan: { gold: "#fbbf24", neon: "#22d3ee" },
      teal: { gold: "#fbbf24", neon: "#2dd4bf" },
      emerald: { gold: "#fbbf24", neon: "#34d399" },
      rose: { gold: "#fbbf24", neon: "#fb7185" },
      pink: { gold: "#fbbf24", neon: "#f472b6" },
      fuchsia: { gold: "#fbbf24", neon: "#e879f9" },
      purple: { gold: "#fbbf24", neon: "#a78bfa" },
      violet: { gold: "#fbbf24", neon: "#c084fc" },
      amber: { gold: "#10b981", neon: "#fbbf24" }, 
      orange: { gold: "#38bdf8", neon: "#fb923c" },
      red: { gold: "#fbbf24", neon: "#f87171" },
      slate: { gold: "#fbbf24", neon: "#94a3b8" },
      zinc: { gold: "#fbbf24", neon: "#a1a1aa" },
      secondary: { gold: "#fbbf24", neon: "#6366f1" },
      accent: { gold: "#fbbf24", neon: "#8b5cf6" },
      lime: { gold: "#1e3a8a", neon: "#bef264" },
      yellow: { gold: "#4a044e", neon: "#facc15" },
    };

    // Fallback for custom hex codes or unknown names
    let pair = arcanePairs[colorName];
    if (!pair) {
      if (colorName.startsWith('#') || colorName.startsWith('rgb') || colorName.startsWith('hsl')) {
        // If it's a hex or rgb, use it as neon, use default gold
        pair = { gold: "#fbbf24", neon: colorName };
      } else {
        const customTheme = THEMES.find(t => t.id === colorName);
        if (customTheme && customTheme.colors && customTheme.colors.length > 0) {
           let neon = "#38bdf8";
           let gold = "#fbbf24";

           const extractColor = (cStr: string, defaultColor: string) => {
             const hexMatch = cStr.match(/#([a-fA-F0-9]{3,6})/);
             if (hexMatch) return hexMatch[0];
             
             // Check if it has a tailwind color name
             const tailwindColors: Record<string, string> = {
               red: "#ef4444", blue: "#3b82f6", green: "#22c55e", 
               yellow: "#eab308", purple: "#a855f7", pink: "#ec4899", 
               indigo: "#6366f1", teal: "#14b8a6", orange: "#f97316",
               cyan: "#06b6d4", lime: "#84cc16", amber: "#f59e0b",
               emerald: "#10b981", fuchsia: "#d946ef", rose: "#f43f5e",
               slate: "#64748b", zinc: "#71717a", base: "#38bdf8",
               black: "#111111", white: "#f8fafc", violet: "#8b5cf6"
             };
             for (const key of Object.keys(tailwindColors)) {
               if (cStr.includes(key)) return tailwindColors[key];
             }
             return defaultColor;
           };

           neon = extractColor(customTheme.colors[0], neon);
           if (customTheme.colors[1]) {
             gold = extractColor(customTheme.colors[1], gold);
           } else {
             gold = "#fbbf24"; // Default gold if no secondary
           }
           pair = { gold, neon };
        } else {
           // check if colorName itself is a tailwind color like "red"
           const baseColorName = colorName.split('-')[0];
           pair = arcanePairs[baseColorName] || arcanePairs['sky'];
        }
      }
    }

    const baseNeon = pair.neon;
    
    // Generate variants based on the chosen neon color
    return { 
      gold: pair.gold, 
      neon: baseNeon, 
      border: adjustColor(baseNeon, 0.4), 
      bgLight: adjustColorWithAlpha(baseNeon, 1.0, 0.15),
      bgDark: adjustColor(baseNeon, 0.08), 
      bgDarkest: adjustColor(baseNeon, 0.04),
      neonMuted: adjustColorWithAlpha(baseNeon, 1.0, 0.3)
    };
  };

  const tColors = getColorsForDoc(documents[0]?.group || "Ungrouped");

  return (
    <Document title="Document Export" author="System">
      {includeCover ? (
        <Page size="A4" style={{ backgroundColor: tColors.bgDark, position: 'relative' }}>
          <ArcaneBackgroundGraphics colors={tColors} isCover={true} />
          
          <View style={{ flex: 1, padding: 60, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '100%', alignItems: 'center', backgroundColor: tColors.bgDarkest, padding: 40, borderWidth: 2, borderColor: tColors.gold, marginTop: 150, position: 'relative' }}>
              <View style={{ position: 'absolute', top: -5, left: -5, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: tColors.neon }} />
              <View style={{ position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3, borderColor: tColors.neon }} />
              <View style={{ position: 'absolute', bottom: -5, left: -5, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: tColors.neon }} />
              <View style={{ position: 'absolute', bottom: -5, right: -5, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3, borderColor: tColors.neon }} />
              
              {/* Graphical Status Readout instead of text */}
              <View style={{ marginBottom: 24, height: 14, width: 220, flexDirection: 'row', gap: 2, alignItems: 'center', backgroundColor: tColors.bgLight, padding: 2, borderBottomWidth: 1, borderTopWidth: 1, borderColor: tColors.neonMuted }}>
                {[...Array(20)].map((_, i) => (
                  <View key={i} style={{ flex: 1, height: i % 5 === 0 ? 8 : 4, backgroundColor: i < 15 ? tColors.neon : tColors.gold, opacity: i < 15 ? 0.6 : 0.2 }} />
                ))}
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tColors.neon, marginLeft: 4 }} />
              </View>

              <Text style={{ fontSize: 44, color: '#f8fafc', fontFamily: 'Inter', fontWeight: 700, lineHeight: 1.1, textAlign: 'center', marginBottom: 32, textTransform: 'uppercase' }}>
                {documents.length > 0 ? documents[0].title : 'System Log'}
              </Text>
              
              <View style={{ width: '100%', alignItems: 'center', marginBottom: 32 }}>
                <Svg width="200" height="15" viewBox="0 0 200 15">
                  <Line x1="0" y1="7.5" x2="80" y2="7.5" stroke={tColors.neon} strokeWidth="1" />
                  <Polygon points="100,0 110,7.5 100,15 90,7.5" fill="none" stroke={tColors.gold} strokeWidth="1" />
                  <Circle cx="100" cy="7.5" r="2" fill={tColors.neon} />
                  <Line x1="120" y1="7.5" x2="200" y2="7.5" stroke={tColors.neon} strokeWidth="1" />
                </Svg>
              </View>
              {(documents[0] as any)?.metadata?.description ? (
                <Text style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'Inter', lineHeight: 1.6, textAlign: 'center', paddingHorizontal: 20 }}>
                   {(documents[0] as any).metadata.description}
                </Text>
              ) : <View />}
            </View>
          </View>
        </Page>
      ) : []}

      {includeToc && documents.length > 1 ? <ArcaneTableOfContents documents={documents} docColors={tColors} /> : null}

      {documents.map((doc, dIdx) => (
        <Page key={dIdx} size="A4" style={{ backgroundColor: getColorsForDoc(doc.group || "Ungrouped").bgDark, padding: 60, paddingBottom: 80, position: 'relative' }}>
          <ArcaneBackgroundGraphics colors={getColorsForDoc(doc.group || "Ungrouped")} />
          
          {/* Header Graphic */}
          <View fixed style={{ position: 'absolute', top: 30, right: 60, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <View style={{ width: 40, height: 2, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").neon, opacity: 0.4 }} />
            <View style={{ width: 8, height: 8, borderWidth: 1, borderColor: getColorsForDoc(doc.group || "Ungrouped").gold, transform: 'rotate(45deg)' }} />
            <View style={{ width: 100, height: 1, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").border, opacity: 0.3 }} />
          </View>

          <View style={{ marginBottom: 40, alignItems: 'center' }}>
             <View style={{ position: 'relative', paddingHorizontal: 32, paddingVertical: 16, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").bgDarkest, borderWidth: 1, borderColor: getColorsForDoc(doc.group || "Ungrouped").neonMuted }}>
               <View style={{ position: 'absolute', top: -4, left: -4, width: 16, height: 16, borderTopWidth: 2, borderLeftWidth: 2, borderColor: getColorsForDoc(doc.group || "Ungrouped").neon }} />
               <View style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderTopWidth: 2, borderRightWidth: 2, borderColor: getColorsForDoc(doc.group || "Ungrouped").neon }} />
               <View style={{ position: 'absolute', bottom: -4, left: -4, width: 16, height: 16, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: getColorsForDoc(doc.group || "Ungrouped").gold }} />
               <View style={{ position: 'absolute', bottom: -4, right: -4, width: 16, height: 16, borderBottomWidth: 2, borderRightWidth: 2, borderColor: getColorsForDoc(doc.group || "Ungrouped").gold }} />
               
               {/* Technical detailing on title box */}
               <View style={{ position: 'absolute', top: '50%', left: -30, width: 25, height: 2, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").neon, opacity: 0.8 }} />
               <View style={{ position: 'absolute', top: '50%', right: -30, width: 25, height: 2, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").neon, opacity: 0.8 }} />

               <Text style={{ fontSize: 26, color: getColorsForDoc(doc.group || "Ungrouped").gold, fontFamily: 'Inter', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 4 }}>
                {doc.title}
               </Text>
             </View>
             
             <View style={{ width: '100%', alignItems: 'center', marginTop: 25 }}>
                <Svg width="200" height="20" viewBox="0 0 200 20">
                  <Line x1="0" y1="10" x2="85" y2="10" stroke={getColorsForDoc(doc.group || "Ungrouped").neon} strokeWidth="1.5" />
                  <Polygon points="100,2 108,10 100,18 92,10" fill="none" stroke={getColorsForDoc(doc.group || "Ungrouped").gold} strokeWidth="2" />
                  <Circle cx="100" cy="10" r="3" fill={getColorsForDoc(doc.group || "Ungrouped").neon} />
                  <Line x1="115" y1="10" x2="200" y2="10" stroke={getColorsForDoc(doc.group || "Ungrouped").neon} strokeWidth="1.5" />
                </Svg>
             </View>
          </View>

          {doc.blocks.map((block, bIdx) => (
             <ArcaneBlockRenderer key={bIdx} block={block} docColors={getColorsForDoc(doc.group || "Ungrouped")} isExam={isExam} />
          ))}

          {/* Footer with Technical Brackets */}
          <View fixed style={{ position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").bgDarkest, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderColor: getColorsForDoc(doc.group || "Ungrouped").border, position: 'relative' }}>
              <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").neon }} />
              <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 2, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").neon }} />
              
              <View style={{ width: 4, height: 4, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").neon, transform: 'rotate(45deg)' }} />
              <Text style={{ fontSize: 10, color: getColorsForDoc(doc.group || "Ungrouped").gold, fontFamily: 'Courier', fontWeight: 700, letterSpacing: 2 }} render={({ pageNumber, totalPages }) => `SEC[${pageNumber}/${totalPages}]`} />
              <View style={{ width: 40, height: 1, backgroundColor: `${getColorsForDoc(doc.group || "Ungrouped").gold}4D` }} />
              <View style={{ width: 4, height: 4, backgroundColor: getColorsForDoc(doc.group || "Ungrouped").neon, transform: 'rotate(45deg)' }} />
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
};

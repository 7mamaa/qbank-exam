import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Line, Circle, Rect, Polygon, Font, Defs, LinearGradient, RadialGradient, Stop, G } from '@react-pdf/renderer';
import { THEMES } from '../../constants/themes';

// Register Inter and JetBrains Mono
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', fontWeight: 700 }
  ]
});

Font.register({
  family: 'JetBrains Mono',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/spacemono/v17/i7dPIFZifjKcF5UAWdDRUEY.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/spacemono/v17/i7dMIFZifjKcF5UAWdDRaPpZYFI.ttf', fontWeight: 700 }
  ]
});

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

const UltimateRichText = ({ text, baseStyle, docColors }: { text: string; baseStyle: any; docColors?: any }): any => {
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
          return <UltimateRichText key={i} text={content} baseStyle={{ ...style, fontWeight: 700, color: '#0f172a' }} docColors={docColors} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <UltimateRichText key={i} text={content} baseStyle={{ ...style, color: '#64748b' }} docColors={docColors} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          return <UltimateRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: docColors?.bgLight || 'rgba(0, 0, 0, 0.05)', color: docColors?.neon || '#0f172a', paddingVertical: 2, paddingHorizontal: 4, borderRadius: 4 }} docColors={docColors} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = '#0f172a';
          style.fontFamily = isArabic(content) ? 'Cairo' : 'Space Mono';
          style.backgroundColor = '#f1f5f9';
          style.padding = '2px 4px';
          style.borderRadius = 4;
          return <Text key={i} style={style}>{content}</Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.fontWeight = 700;
          style.color = docColors.secondary || '#a855f7';
          return <Text key={i} style={style}>{`[Asset: ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

const UltimateBlockRenderer = ({ block, docColors, isExam }: { block: PdfBlock, docColors: any, isExam: boolean }) => {
  if (!block) return <View />;
  const content = block.content || '';
  const isRtl = isArabic(prepareInteractiveSyntax(content));

  switch (block.type) {
    case 'heading':
      return (
        <View wrap={false} style={{ marginBottom: 24, marginTop: 48, alignItems: isRtl ? 'flex-end' : 'flex-start', position: 'relative' }}>
          <View style={{ position: 'absolute', top: -12, left: isRtl ? 'auto' : -24, right: isRtl ? -24 : 'auto', opacity: 0.05, zIndex: -1 }}>
             <Text style={{ fontSize: 72, fontFamily: 'Inter', fontWeight: 900, color: docColors.neon, letterSpacing: -2 }}>
               {content.substring(0, 2).toUpperCase()}
             </Text>
          </View>
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ marginTop: 6, width: 10, height: 10, backgroundColor: docColors.neon, transform: 'rotate(45deg)', marginRight: isRtl ? 0 : 16, marginLeft: isRtl ? 16 : 0 }} />
            <UltimateRichText text={content} baseStyle={{ fontSize: 26, fontFamily: 'Inter', fontWeight: 900, color: '#0f172a', lineHeight: 1.2, letterSpacing: -1 }} docColors={docColors} />
          </View>
          <View style={{ marginTop: 12, height: 2, width: '100%', backgroundColor: docColors.bgLight, alignSelf: 'stretch' }}>
             <View style={{ height: 2, width: '30%', backgroundColor: docColors.secondary, alignSelf: isRtl ? 'flex-end' : 'flex-start' }} />
          </View>
        </View>
      );
    case 'subheading':
      return (
        <View wrap={false} style={{ marginTop: 32, marginBottom: 16, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
           <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingRight: isRtl ? 16 : 24, paddingLeft: isRtl ? 24 : 16, paddingVertical: 10, borderRadius: 30, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <View style={{ backgroundColor: '#ffffff', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: isRtl ? 0 : 12, marginLeft: isRtl ? 12 : 0 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: docColors.secondary }} />
              </View>
              <UltimateRichText text={content} baseStyle={{ fontSize: 16, fontFamily: 'Inter', fontWeight: 700, color: '#1e293b', textAlign: isRtl ? 'right' : 'left', letterSpacing: -0.2 }} docColors={docColors} />
           </View>
         </View>
      );
    case 'subtitle':
      return (
        <View wrap={false} style={{ marginTop: 20, marginBottom: 12, alignSelf: isRtl ? 'flex-end' : 'flex-start', flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
          <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={docColors.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: isRtl ? 0 : 8, marginLeft: isRtl ? 8 : 0 }}>
             <Path d="m9 18 6-6-6-6" />
          </Svg>
          <View style={{ borderBottomWidth: 1, borderBottomColor: docColors.secondary, paddingBottom: 2 }}>
            <UltimateRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Space Mono', fontWeight: 700, color: docColors.secondary, textAlign: isRtl ? 'right' : 'left', letterSpacing: 2, textTransform: 'uppercase' }} docColors={docColors} />
          </View>
        </View>
      );
    case 'paragraph':
    case 'text':
    case 'plain':
      if (content.trim() === '') return <View style={{ height: 12 }} />;
      return (
        <View style={{ marginBottom: 16 }}>
           <UltimateRichText text={content} baseStyle={{ fontSize: 11.5, fontFamily: 'Inter', lineHeight: 1.7, color: '#1e293b', textAlign: isRtl ? 'right' : 'left' }} docColors={docColors} />
        </View>
      );
    case 'example': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 20, backgroundColor: '#fcfcfc', padding: 24, borderRadius: 0, borderWidth: 1, borderColor: docColors.neon, borderStyle: 'dashed', position: 'relative' }}>
          <View style={{ position: 'absolute', top: -10, left: isBoxRtl ? 'auto' : 24, right: isBoxRtl ? 24 : 'auto', backgroundColor: docColors.neon, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
             <Text style={{ fontSize: 9, color: '#ffffff', fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Example</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <UltimateRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#1e293b', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
          </View>
        </View>
      );
    }
    case 'explanation': {
        const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
        return (
          <View wrap={false} style={{ marginVertical: 24, paddingLeft: isBoxRtl ? 0 : 32, paddingRight: isBoxRtl ? 32 : 0, borderLeftWidth: isBoxRtl ? 0 : 4, borderRightWidth: isBoxRtl ? 4 : 0, borderColor: docColors.secondary, position: 'relative' }}>
             <Svg style={{ position: 'absolute', top: 0, left: isBoxRtl ? 'auto' : -18, right: isBoxRtl ? -18 : 'auto', opacity: 0.1 }} width="40" height="40" viewBox="0 0 24 24" fill={docColors.secondary}>
                <Circle cx="12" cy="12" r="10" />
             </Svg>
             <Text style={{ fontSize: 10, color: docColors.secondary, fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, textAlign: isBoxRtl ? 'right' : 'left' }}>Analysis</Text>
             <UltimateRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Inter', color: '#334155', lineHeight: 1.7, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
          </View>
        );
    }
    case 'note': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 20, padding: 20, backgroundColor: '#fef08a', transform: 'rotate(-1deg)' }}>
           <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: isBoxRtl ? 'flex-end' : 'flex-start' }}>
               <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a16207" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: isBoxRtl ? 0 : 8, marginLeft: isBoxRtl ? 8 : 0 }}>
                 <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                 <Path d="M14 2v6h6" />
               </Svg>
               <Text style={{ fontSize: 11, color: '#854d0e', fontFamily: 'Inter', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Note</Text>
           </View>
           <UltimateRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', fontStyle: 'italic', color: '#713f12', lineHeight: 1.5, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
        </View>
      );
    }
    case 'tip': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 20 }}>
          <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 16, paddingVertical: 6, alignSelf: isBoxRtl ? 'flex-end' : 'flex-start', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
             <Text style={{ fontSize: 10, color: '#ffffff', fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Pro Tip</Text>
          </View>
          <View style={{ backgroundColor: '#f0fdf4', padding: 24, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderTopRightRadius: isBoxRtl ? 0 : 8, borderTopLeftRadius: isBoxRtl ? 8 : 0, borderWidth: 2, borderColor: '#22c55e', borderTopWidth: 0 }}>
             <UltimateRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#14532d', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
          </View>
        </View>
      );
    }
    case 'high_yield': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 24, padding: 24, backgroundColor: '#0f172a', borderRadius: 16, position: 'relative', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: -20, right: -20, opacity: 0.1 }}>
             <Svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1">
                <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
             </Svg>
          </View>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 12 }}>
             <Text style={{ color: '#fda4af', fontSize: 13, fontWeight: 700, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 3 }}>High Yield</Text>
          </View>
          <UltimateRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Inter', color: '#f8fafc', fontWeight: 500, lineHeight: 1.7, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
        </View>
      );
    }
    case 'list':
      if (block.items && block.items.length > 0) {
        return (
          <View style={{ marginVertical: 12 }}>
            {block.items.map((item, iIdx) => {
              const isItemRtl = isArabic(prepareInteractiveSyntax(item));
              return (
                <View wrap={false} key={iIdx} style={{ flexDirection: isItemRtl ? 'row-reverse' : 'row', marginBottom: 10, alignItems: 'flex-start' }}>
                  <View style={{ width: 24, marginTop: 2, alignItems: 'center' }}>
                    {(block as any).ordered || block.type === 'step' ? (
                      <View style={{ backgroundColor: '#0f172a', width: 18, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Space Mono', color: '#ffffff', fontWeight: 700 }}>{iIdx + 1}</Text>
                      </View>
                    ) : (
                      <View style={{ marginTop: 4 }}>
                        <View style={{ width: 6, height: 6, backgroundColor: docColors.neon, transform: 'rotate(45deg)' }} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: isItemRtl ? 0 : 12, marginRight: isItemRtl ? 12 : 0 }}>
                     <UltimateRichText text={item} baseStyle={{ fontSize: 11, fontFamily: 'Inter', lineHeight: 1.6, color: '#334155', textAlign: isItemRtl ? 'right' : 'left' }} docColors={docColors} />
                  </View>
                </View>
              );
            })}
          </View>
        );
      }
      
      // Fallback for single item 'list'
      const isListRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 8, paddingLeft: isListRtl ? 0 : 8, paddingRight: isListRtl ? 8 : 0 }}>
          <View style={{ flexDirection: isListRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ width: 18, marginTop: 4, alignItems: 'center' }}>
               <View style={{ width: 6, height: 6, backgroundColor: docColors.neon, transform: 'rotate(45deg)' }} />
            </View>
            <View style={{ flex: 1 }}>
               <UltimateRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', lineHeight: 1.6, color: '#334155', textAlign: isListRtl ? 'right' : 'left' }} docColors={docColors} />
            </View>
          </View>
        </View>
      );
    case 'quote':
      const isQuoteRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 28, paddingHorizontal: 32, paddingVertical: 24, position: 'relative' }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: isQuoteRtl ? 'auto' : 0, right: isQuoteRtl ? 0 : 'auto', width: 4, backgroundColor: docColors.neon }} />
          <View style={{ position: 'absolute', top: -10, left: isQuoteRtl ? 'auto' : 24, right: isQuoteRtl ? 24 : 'auto', backgroundColor: '#ffffff', paddingHorizontal: 8 }}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill={docColors.secondary} stroke="none">
              <Path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.036c0 3 1 3 1 3zm14 0c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.036c0 3 1 3 1 3z" />
            </Svg>
          </View>
          <View style={{ flexDirection: isQuoteRtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
             <View style={{ flex: 1 }}>
                <UltimateRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'Inter', fontStyle: 'italic', fontWeight: 700, color: '#0f172a', textAlign: isQuoteRtl ? 'right' : 'left', lineHeight: 1.7, letterSpacing: -0.2 }} docColors={docColors} />
             </View>
          </View>
        </View>
      );
    case 'code':
      return (
        <View wrap={false} style={{ marginVertical: 24, backgroundColor: '#020617', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', position: 'relative', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: docColors.secondary, opacity: 0.5 }} />
          <View style={{ position: 'absolute', bottom: -20, right: -20, opacity: 0.05 }}>
             <Svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1">
               <Path d="m18 16 4-4-4-4" />
               <Path d="m6 8-4 4 4 4" />
               <Path d="m14.5 4-5 16" />
             </Svg>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
            <View style={{ flexDirection: 'row' }}>
              <Circle cx="6" cy="6" r="4" fill="#ef4444" />
              <Circle cx="20" cy="6" r="4" fill="#eab308" />
              <Circle cx="34" cy="6" r="4" fill="#22c55e" />
            </View>
            <Text style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 9, fontFamily: 'Space Mono', color: '#64748b', textTransform: 'uppercase', letterSpacing: 2 }}>Code Snippet</Text>
          </View>
          <View style={{ padding: 24 }}>
            <Text style={{ fontFamily: 'Space Mono', fontSize: 11, color: '#e2e8f0', lineHeight: 1.7 }}>
              {content}
            </Text>
          </View>
        </View>
      );
    case 'table':
        return (
          <View wrap={false} style={{ marginVertical: 28, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#cbd5e1', position: 'relative' }}>
            <View style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.05 }}>
               <Svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke={docColors.neon} strokeWidth="1">
                  <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <Line x1="3" y1="9" x2="21" y2="9" />
                  <Line x1="3" y1="15" x2="21" y2="15" />
                  <Line x1="9" y1="3" x2="9" y2="21" />
                  <Line x1="15" y1="3" x2="15" y2="21" />
               </Svg>
            </View>
            {block.columns && block.columns.length > 0 ? (
              <View style={{ flexDirection: 'row', backgroundColor: '#0f172a', padding: 16 }}>
                {block.columns.map((col, cIdx) => (
                  <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4 }}>
                     <UltimateRichText text={col} baseStyle={{ fontSize: 10, fontWeight: 700, color: '#f8fafc', fontFamily: 'Space Mono', textTransform: 'uppercase', letterSpacing: 1 }} docColors={docColors} />
                  </View>
                ))}
              </View>
            ) : <View style={{ height: 0 }} />}
            <View style={{ flexDirection: 'column', backgroundColor: 'rgba(255,255,255,0.8)' }}>
              {(block.rows || []).map((row, rIdx) => (
                <View key={rIdx} style={{ flexDirection: 'row', backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'rgba(241, 245, 249, 0.4)', padding: 16, borderBottomWidth: rIdx === block.rows!.length - 1 ? 0 : 1, borderColor: '#e2e8f0' }}>
                  {row.map((cell, cIdx) => (
                     <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4, justifyContent: 'center' }}>
                       <UltimateRichText text={cell} baseStyle={{ fontSize: 11, color: '#1e293b', fontFamily: 'Inter', lineHeight: 1.6 }} docColors={docColors} />
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
        <View wrap={false} style={{ marginVertical: 28, alignItems: 'center' }}>
          <View style={{ position: 'relative', padding: 16, backgroundColor: '#f8fafc', borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <View style={{ position: 'absolute', top: -10, left: -10, width: 40, height: 40, borderTopWidth: 2, borderLeftWidth: 2, borderColor: docColors.neon, borderRadius: 8 }} />
            <View style={{ position: 'absolute', bottom: -10, right: -10, width: 40, height: 40, borderBottomWidth: 2, borderRightWidth: 2, borderColor: docColors.neon, borderRadius: 8 }} />
            <View style={{ backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', padding: 4 }}>
              <Image src={block.imageUrl} style={{ width: 432, height: 'auto', borderRadius: 12, objectFit: 'cover' }} />
            </View>
          </View>
        </View>
      );
    case 'warning': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 20, position: 'relative', overflow: 'hidden' }}>
          <View style={{ backgroundColor: '#ef4444', padding: 8, flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center' }}>
             <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: isBoxRtl ? 0 : 8, marginLeft: isBoxRtl ? 8 : 0 }}>
               <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
               <Path d="M12 9v4" />
               <Path d="M12 17h.01" />
             </Svg>
             <Text style={{ fontSize: 11, color: '#ffffff', fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Warning</Text>
          </View>
          <View style={{ backgroundColor: '#fef2f2', padding: 24, borderWidth: 2, borderColor: '#ef4444', borderTopWidth: 0 }}>
             <UltimateRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#991b1b', lineHeight: 1.6, textAlign: 'center' }} docColors={docColors} />
          </View>
        </View>
      );
    }
    case 'clinical_correlation': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 24, flexDirection: 'row', backgroundColor: '#f0f9ff', overflow: 'hidden', borderWidth: 1, borderColor: '#bae6fd' }}>
           <View style={{ width: 40, backgroundColor: '#0ea5e9', justifyContent: 'center', alignItems: 'center' }}>
              <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-90deg)' }}>
                <Path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </Svg>
           </View>
           <View style={{ flex: 1, padding: 20 }}>
             <Text style={{ fontSize: 10, color: '#0369a1', fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, textAlign: isBoxRtl ? 'right' : 'left' }}>Clinical Correlation</Text>
             <UltimateRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#0c4a6e', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
           </View>
        </View>
      );
    }
    case 'reference': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 12, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#f1f5f9', borderRadius: 0, borderLeftWidth: 2, borderLeftColor: '#94a3b8' }}>
           <UltimateRichText text={content} baseStyle={{ fontSize: 9, fontFamily: 'Space Mono', color: '#475569', lineHeight: 1.5, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
        </View>
      );
    }
    case 'vocabulary': {
      const termRtl = isArabic(prepareInteractiveSyntax(block.term || ''));
      const defRtl = isArabic(prepareInteractiveSyntax(block.definition || content));
      return (
        <View wrap={false} style={{ marginVertical: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 12 }}>
          <View style={{ width: '30%', paddingRight: 16 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Space Mono', fontWeight: 700, color: docColors.neon, textAlign: termRtl ? 'right' : 'left' }}>{block.term || 'Term'}</Text>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: '#f1f5f9', paddingLeft: 16 }}>
            <UltimateRichText text={block.definition || content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#475569', lineHeight: 1.6, textAlign: defRtl ? 'right' : 'left' }} docColors={docColors} />
          </View>
        </View>
      );
    }
    case 'flashcard': {
      const frontRtl = isArabic(prepareInteractiveSyntax(block.front || ''));
      const backRtl = isArabic(prepareInteractiveSyntax(block.back || content));
      return (
        <View wrap={false} style={{ marginVertical: 24, flexDirection: 'row', alignItems: 'stretch' }}>
          <View style={{ flex: 1, backgroundColor: '#1e293b', padding: 24, justifyContent: 'center', alignItems: 'center', borderTopLeftRadius: 16, borderBottomLeftRadius: 16, position: 'relative' }}>
             <Text style={{ position: 'absolute', top: 12, left: 16, fontSize: 8, color: '#64748b', fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Front</Text>
             <UltimateRichText text={block.front || 'Card Front'} baseStyle={{ fontSize: 14, fontFamily: 'Inter', fontWeight: 700, color: '#f8fafc', textAlign: 'center' }} docColors={docColors} />
          </View>
          <View style={{ flex: 1, backgroundColor: docColors.bgLight, padding: 24, justifyContent: 'center', alignItems: 'center', borderTopRightRadius: 16, borderBottomRightRadius: 16, position: 'relative', borderWidth: 1, borderLeftWidth: 0, borderColor: docColors.border }}>
             <Text style={{ position: 'absolute', top: 12, right: 16, fontSize: 8, color: docColors.secondary, fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Back</Text>
             <UltimateRichText text={block.back || content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#0f172a', textAlign: 'center', lineHeight: 1.6 }} docColors={docColors} />
          </View>
        </View>
      );
    }
    case 'dialogue': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      const personA = (block as any).person || 'A';
      return (
        <View wrap={false} style={{ marginVertical: 12, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: isBoxRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <View style={{ backgroundColor: docColors.neon, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: isBoxRtl ? 0 : 12, marginLeft: isBoxRtl ? 12 : 0 }}>
               <Text style={{ color: '#ffffff', fontSize: 12, fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase' }}>{personA[0]}</Text>
            </View>
            <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, borderTopLeftRadius: isBoxRtl ? 16 : 4, borderTopRightRadius: isBoxRtl ? 4 : 16, flex: 1, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <UltimateRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#1e293b', lineHeight: 1.6, textAlign: isBoxRtl ? 'right' : 'left' }} docColors={docColors} />
            </View>
          </View>
        </View>
      );
    }

    case 'summary':
    case 'expandable':
    case 'reveal':
    case 'bento':
    case 'container':
      const isRtlAlign = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 24, padding: 28, backgroundColor: docColors.bgLight, borderRadius: 24, borderWidth: 1, borderColor: docColors.border, position: 'relative', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, backgroundColor: docColors.neon, opacity: 0.05, borderBottomLeftRadius: 80 }} />
          <View style={{ position: 'absolute', bottom: 0, left: 0, width: 60, height: 60, backgroundColor: '#ffffff', opacity: 0.5, borderTopRightRadius: 60 }} />
          <View style={{ marginBottom: 16, flexDirection: isRtlAlign ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', marginRight: isRtlAlign ? 0 : 12, marginLeft: isRtlAlign ? 12 : 0 }}>
               <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={docColors.neon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                 <Path d="M12 20h9" />
                 <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
               </Svg>
            </View>
            <Text style={{ fontSize: 16, fontFamily: 'Inter', color: '#0f172a', fontWeight: 900, letterSpacing: -0.5 }}>{block.title || block.type.replace('_', ' ')}</Text>
          </View>
          <UltimateRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'Inter', color: '#1e293b', lineHeight: 1.7, textAlign: isRtlAlign ? 'right' : 'left' }} docColors={docColors} />
        </View>
      );
    case 'caption':
      return (
        <View wrap={false} style={{ marginVertical: 8, paddingHorizontal: 16 }}>
           <UltimateRichText text={content} baseStyle={{ fontSize: 9, fontFamily: 'Space Mono', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }} docColors={docColors} />
        </View>
      );
    case 'horizontal_rule':
      return (
        <View style={{ marginVertical: 24, height: 2, backgroundColor: '#f1f5f9', width: '80%', alignSelf: 'center' }}>
          <View style={{ height: 2, backgroundColor: docColors.neon, width: '20%', alignSelf: 'center' }} />
        </View>
      );
    case 'page_break':
      return <View break />;
    case 'essay_area':
      return (
        <View wrap={false} style={{ marginVertical: 24, padding: 24, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', minHeight: 150 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Space Mono', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Notes / Essay Area</Text>
          <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#f8fafc', marginTop: 8 }} />
          <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#f8fafc', marginTop: 24 }} />
          <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#f8fafc', marginTop: 24 }} />
          <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#f8fafc', marginTop: 24 }} />
        </View>
      );
    default:
      return (
        <View style={{ marginBottom: 8 }}>
           <UltimateRichText text={content} baseStyle={{ fontSize: 11, fontFamily: 'Inter', color: '#334155' }} docColors={docColors} />
        </View>
      );
  }
};

const UltimateBackgroundGraphics = ({ colors, variant = 'page' }: { colors: any, variant?: 'page' | 'cover' | 'toc' }) => {
  if (variant !== 'cover') {
    return (
      <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
        <Rect x="0" y="0" width="595" height="842" fill="#ffffff" />
        <Defs>
          <LinearGradient id="pageGlow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.neon} stopOpacity="0.03" />
            <Stop offset="1" stopColor={colors.secondary} stopOpacity="0.01" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="595" height="842" fill="url('#pageGlow')" />

        {/* Refined Engineering Grid */}
        <G opacity="0.15">
           {[...Array(85)].map((_, i) => (
              <Line key={`hgrid-${i}`} x1="0" y1={i * 10} x2="595" y2={i * 10} stroke={colors.secondary} strokeWidth={i % 5 === 0 ? "0.3" : "0.1"} />
           ))}
           {[...Array(60)].map((_, i) => (
              <Line key={`vgrid-${i}`} x1={i * 10} y1="0" x2={i * 10} y2="842" stroke={colors.secondary} strokeWidth={i % 5 === 0 ? "0.3" : "0.1"} />
           ))}
        </G>

        {/* Minimalist Tech Frames */}
        <Rect x="20" y="20" width="555" height="802" fill="none" stroke={colors.neon} strokeWidth="0.5" opacity="0.3" />
        <Rect x="24" y="24" width="547" height="794" fill="none" stroke={colors.secondary} strokeWidth="0.25" opacity="0.5" />
        
        {/* Corner Registration Marks */}
        <G opacity="0.6">
          <Path d="M15 15 L35 15 M15 15 L15 35" stroke={colors.neon} strokeWidth="1" />
          <Circle cx="20" cy="20" r="1.5" fill={colors.secondary} />
          <Path d="M580 15 L560 15 M580 15 L580 35" stroke={colors.neon} strokeWidth="1" />
          <Circle cx="575" cy="20" r="1.5" fill={colors.secondary} />
          <Path d="M15 827 L35 827 M15 827 L15 807" stroke={colors.neon} strokeWidth="1" />
          <Circle cx="20" cy="822" r="1.5" fill={colors.secondary} />
          <Path d="M580 827 L560 827 M580 827 L580 807" stroke={colors.neon} strokeWidth="1" />
          <Circle cx="575" cy="822" r="1.5" fill={colors.secondary} />
        </G>

        {/* Precision Margin Indicators */}
        <G opacity="0.3">
          {[...Array(20)].map((_, i) => (
            <Line key={`lscale-${i}`} x1="20" y1={100 + i * 30} x2={i % 5 === 0 ? "26" : "23"} y2={100 + i * 30} stroke={colors.neon} strokeWidth="0.5" />
          ))}
          {[...Array(15)].map((_, i) => (
            <Line key={`bscale-${i}`} x1={100 + i * 30} y1="822" x2={100 + i * 30} y2={i % 5 === 0 ? "816" : "819"} stroke={colors.secondary} strokeWidth="0.5" />
          ))}
          {[...Array(15)].map((_, i) => (
            <Line key={`tscale-${i}`} x1={100 + i * 30} y1="20" x2={100 + i * 30} y2={i % 5 === 0 ? "26" : "23"} stroke={colors.secondary} strokeWidth="0.5" />
          ))}
        </G>

        <G opacity="0.06" transform="translate(450, 600) scale(1.5)">
          <Circle cx="0" cy="0" r="50" fill="none" stroke={colors.secondary} strokeWidth="2" strokeDasharray="5 5" />
          <Circle cx="0" cy="0" r="30" fill="none" stroke={colors.neon} strokeWidth="1" />
          <Circle cx="0" cy="0" r="10" fill={colors.secondary} />
          <Line x1="-60" y1="0" x2="60" y2="0" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="2 2" />
          <Line x1="0" y1="-60" x2="0" y2="60" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="2 2" />
        </G>

        {/* Faint technical arcs */}
        <Path d="M 595 100 Q 500 150 450 300" fill="none" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="10 5" opacity="0.1" />
        <Path d="M 0 700 Q 100 650 150 500" fill="none" stroke={colors.secondary} strokeWidth="0.3" strokeDasharray="5 5" opacity="0.2" />

        {/* Fine elegant datastream running vertically */}
        <G opacity="0.4">
          <Line x1="45" y1="20" x2="45" y2="822" stroke={colors.neon} strokeWidth="0.2" opacity="0.3" />
          <Rect x="44" y="100" width="2" height="40" fill={colors.secondary} opacity="0.5" />
          <Rect x="44" y="150" width="2" height="15" fill={colors.neon} opacity="0.7" />
          <Rect x="44" y="300" width="2" height="60" fill={colors.secondary} opacity="0.4" />
          <Rect x="44" y="450" width="2" height="20" fill={colors.neon} opacity="0.5" />
          <Rect x="44" y="700" width="2" height="50" fill={colors.secondary} opacity="0.3" />
        </G>
        
        {variant === 'toc' && (
          <G>
             <Rect x="0" y="0" width="40" height="842" fill={colors.neon} opacity="0.04" />
             <Line x1="40" y1="0" x2="40" y2="842" stroke={colors.secondary} strokeWidth="0.5" opacity="0.2" />
             
             {[...Array(20)].map((_, i) => (
                <Circle key={`toc-dot-${i}`} cx="20" cy={50 + i * 40} r="1.5" fill={colors.neon} opacity="0.5" />
             ))}
          </G>
        )}
      </Svg>
    );
  }

  return (
    <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
      <Rect x="0" y="0" width="595" height="842" fill="#ffffff" />
      
      <Defs>
        <LinearGradient id="neonGlowTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.neon} stopOpacity={variant === 'cover' ? "0.15" : "0.03"} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="neonGlowBottomRight" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="1" stopColor={colors.secondary} stopOpacity={variant === 'cover' ? "0.1" : "0.02"} />
        </LinearGradient>
        <RadialGradient id="spotlight1" cx="0.8" cy="0.1" r="0.6">
          <Stop offset="0" stopColor={colors.neon} stopOpacity={variant === 'cover' ? "0.1" : "0.02"} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="spotlight2" cx="0.2" cy="0.9" r="0.6">
          <Stop offset="0" stopColor={colors.secondary} stopOpacity={variant === 'cover' ? "0.1" : "0.02"} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="spotlight3" cx="0.5" cy="0.5" r="0.8">
          <Stop offset="0" stopColor={colors.neon} stopOpacity={variant === 'cover' ? "0.08" : "0.01"} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Atmospheric Glows */}
      <Rect x="0" y="0" width="595" height="400" fill="url('#neonGlowTop')" />
      <Rect x="0" y="0" width="595" height="842" fill="url('#neonGlowBottomRight')" />
      <Circle cx="595" cy="0" r="450" fill="url('#spotlight1')" />
      <Circle cx="0" cy="842" r="450" fill="url('#spotlight2')" />
      <Circle cx="297" cy="421" r="500" fill="url('#spotlight3')" />

      {/* Massive Complex Background Web */}
      <G opacity={variant === 'cover' ? "0.3" : "0.02"}>
        {/* Massive Diagonal Grid */}
        {[...Array(30)].map((_, i) => (
          <Line key={`dg1-${i}`} x1="-200" y1={i * 40} x2="800" y2={(i * 40) - 200} stroke={colors.secondary} strokeWidth="0.5" opacity="0.4" />
        ))}
        {[...Array(30)].map((_, i) => (
          <Line key={`dg2-${i}`} x1="-200" y1={i * 40} x2="800" y2={(i * 40) + 200} stroke={colors.neon} strokeWidth="0.25" opacity="0.3" />
        ))}
        
        {/* Large Concentric Watermarks */}
        <Circle cx="300" cy="400" r="500" fill="none" stroke={colors.secondary} strokeWidth="1" strokeDasharray="5 15" opacity="0.3" />
        <Circle cx="300" cy="400" r="400" fill="none" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="20 40 10 40" opacity="0.5" />
        <Circle cx="300" cy="400" r="300" fill="none" stroke={colors.secondary} strokeWidth="2" strokeDasharray="2 8" opacity="0.2" />
        <Circle cx="300" cy="400" r="200" fill="none" stroke={colors.neon} strokeWidth="0.25" opacity="0.8" />
        <Circle cx="300" cy="400" r="100" fill="none" stroke={colors.secondary} strokeWidth="1" strokeDasharray="1 4" opacity="0.4" />
        
        <Path d="M100 0 L100 842" stroke={colors.secondary} strokeWidth="0.5" strokeDasharray="10 10" opacity="0.5" />
        <Path d="M500 0 L500 842" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="3 6" opacity="0.5" />
        <Path d="M0 200 L595 200" stroke={colors.secondary} strokeWidth="0.25" strokeDasharray="5 5" opacity="0.4" />
        <Path d="M0 600 L595 600" stroke={colors.neon} strokeWidth="0.25" strokeDasharray="5 5" opacity="0.4" />
      </G>

      {/* Structured Background Mapped Areas (Loops replacing patterns) */}
      <G opacity={variant === 'cover' ? "0.3" : "0.03"}>
        {/* Large Tech Crosses Grid */}
        {[...Array(15)].map((_, rx) => 
           [...Array(20)].map((_, ry) => (
             <G key={`tx-${rx}-${ry}`} transform={`translate(${rx * 40}, ${ry * 45})`}>
               <Path d="M25 21L25 29M21 25L29 25" stroke={colors.secondary} strokeWidth="0.5" />
               <Circle cx="25" cy="25" r="1" fill={colors.neon} />
             </G>
           ))
        )}
      </G>

      <G opacity={variant === 'cover' ? "0.2" : "0.03"}>
        {/* Binary Noise and Circuit Nodes scattered */}
        {[...Array(40)].map((_, idx) => {
           const x = (idx * 67) % 595;
           const y = (idx * 83) % 842;
           return (
             <G key={`cn-${idx}`} transform={`translate(${x}, ${y})`}>
               <Rect x="5" y="5" width="2" height="2" fill={colors.neon} opacity="0.3" />
               <Rect x="15" y="25" width="4" height="2" fill={colors.secondary} opacity="0.2" />
               <Line x1="10" y1="10" x2="30" y2="10" stroke={colors.neon} strokeWidth="0.5" opacity="0.3" />
               <Circle cx="30" cy="10" r="2" fill={colors.secondary} />
               <Circle cx="0" cy="30" r="1" fill={colors.neon} />
             </G>
           )
        })}
      </G>

      {/* Extreme Background Complex Geometrics */}
      <G opacity={variant === 'cover' ? "0.85" : "0.15"}>
        {/* Sweeping Architectonic Arcs */}
        <Path d="M -100 842 C 200 400, 400 200, 695 0" fill="none" stroke={colors.neon} strokeWidth="1.5" strokeDasharray="15 30" opacity="0.3" />
        <Path d="M -50 842 C 250 400, 450 200, 745 0" fill="none" stroke={colors.secondary} strokeWidth="0.5" opacity="0.4" />
        <Path d="M 0 842 C 300 400, 500 200, 795 0" fill="none" stroke={colors.neon} strokeWidth="3" opacity="0.1" />
        
        {/* Additional Cross-cutting Arcs */}
        <Path d="M -200 0 C 100 300, 300 500, 795 842" fill="none" stroke={colors.secondary} strokeWidth="1" strokeDasharray="5 10 20 10" opacity="0.3" />
        <Path d="M -100 0 C 200 300, 400 500, 895 842" fill="none" stroke={colors.neon} strokeWidth="0.5" opacity="0.4" />

        {/* Multi-layered Waveforms */}
        <G opacity="0.5">
          {[...Array(12)].map((_, i) => (
             <Path key={`wave-${i}`} d={`M -50 ${700 + i * 20} Q 150 ${600 - i * 15} 350 ${650 + i * 10} T 650 ${550 - i * 25}`} fill="none" stroke={i % 2 === 0 ? colors.neon : colors.secondary} strokeWidth={0.5} opacity={0.3 + (i * 0.05)} />
          ))}
          {[...Array(6)].map((_, i) => (
             <Path key={`wave2-${i}`} d={`M 650 ${200 + i * 30} Q 400 ${300 - i * 10} 250 ${200 + i * 20} T -50 ${300 - i * 15}`} fill="none" stroke={colors.neon} strokeWidth={0.25} strokeDasharray="3 3" opacity={0.4} />
          ))}
        </G>

        {/* Dense Concentric Data Rings - Top Right */}
        <G transform="translate(500, 100)">
          <Circle cx="0" cy="0" r="250" fill="none" stroke={colors.neon} strokeWidth="0.25" strokeDasharray="3 6" />
          <Circle cx="0" cy="0" r="230" fill="none" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="1 10" />
          <Circle cx="0" cy="0" r="210" fill="none" stroke={colors.secondary} strokeWidth="1" opacity="0.3" />
          <Circle cx="0" cy="0" r="180" fill="none" stroke={colors.secondary} strokeWidth="0.2" strokeDasharray="5 5" />
          <Circle cx="0" cy="0" r="150" fill="none" stroke={colors.neon} strokeWidth="0.3" strokeDasharray="15 10 5" />
          <Circle cx="0" cy="0" r="120" fill="none" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="2 12" />
          <Circle cx="0" cy="0" r="100" fill="none" stroke={colors.neon} strokeWidth="2" opacity="0.1" />
          <Circle cx="0" cy="0" r="80" fill="none" stroke={colors.secondary} strokeWidth="1" strokeDasharray="1 4" />
          <Circle cx="0" cy="0" r="60" fill="none" stroke={colors.secondary} strokeWidth="0.5" strokeDasharray="4 2" />
          <Circle cx="0" cy="0" r="40" fill="none" stroke={colors.neon} strokeWidth="0.2" />
          <Circle cx="0" cy="0" r="20" fill={colors.neon} opacity="0.05" />
          
          <Path d="M -300 0 L -80 0" fill="none" stroke={colors.secondary} strokeWidth="0.5" strokeDasharray="2 2" />
          <Path d="M 0 300 L 0 60" fill="none" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="1 5" />
          <Path d="M -200 -200 L -45 -45" fill="none" stroke={colors.secondary} strokeWidth="1" opacity="0.3" />
          <Path d="M 200 -200 L 45 -45" fill="none" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" />
        </G>

        {/* Complex Polygonal Clusters - Bottom Left */}
        <G transform="translate(100, 700)" opacity="0.6">
          <Polygon points="0,-120 104,-60 104,60 0,120 -104,60 -104,-60" fill="none" stroke={colors.secondary} strokeWidth="0.5" opacity="0.3" strokeDasharray="2 4" />
          <Polygon points="0,-80 69,-40 69,40 0,80 -69,40 -69,-40" fill="none" stroke={colors.neon} strokeWidth="1" opacity="0.2" />
          <Polygon points="0,-40 34,-20 34,20 0,40 -34,20 -34,-20" fill={colors.neon} opacity="0.05" stroke={colors.secondary} strokeWidth="0.2" />
          <Circle cx="0" cy="0" r="10" fill="none" stroke={colors.neon} strokeWidth="2" opacity="0.4" />
          <Circle cx="0" cy="0" r="4" fill={colors.secondary} opacity="0.6" />
          
          <Line x1="-150" y1="-150" x2="0" y2="0" stroke={colors.neon} strokeWidth="0.3" strokeDasharray="5 5" />
          <Line x1="100" y1="-80" x2="250" y2="-200" stroke={colors.secondary} strokeWidth="0.2" />
          <Line x1="-50" y1="100" x2="-20" y2="250" stroke={colors.neon} strokeWidth="0.5" />
          <Line x1="-120" y1="0" x2="-250" y2="50" stroke={colors.secondary} strokeWidth="0.5" strokeDasharray="2 2" />
          
          <Circle cx="104" cy="-60" r="3" fill={colors.neon} />
          <Circle cx="-104" cy="60" r="3" fill={colors.secondary} />
          <Circle cx="0" cy="-120" r="4" fill="none" stroke={colors.neon} strokeWidth="1" />
          <Circle cx="0" cy="120" r="4" fill="none" stroke={colors.secondary} strokeWidth="1" />
          <Circle cx="69" cy="40" r="2" fill={colors.neon} />
          <Circle cx="-69" cy="-40" r="2" fill={colors.neon} />
        </G>

        {/* Mid-Right Blueprint Interface node */}
        <G transform="translate(500, 500)" opacity="0.4">
          <Rect x="-40" y="-40" width="80" height="80" fill="none" stroke={colors.secondary} strokeWidth="0.5" strokeDasharray="4 4" />
          <Rect x="-30" y="-30" width="60" height="60" fill="none" stroke={colors.neon} strokeWidth="1" />
          <Rect x="-20" y="-20" width="40" height="40" fill={colors.neon} opacity="0.1" />
          <Line x1="-50" y1="0" x2="50" y2="0" stroke={colors.neon} strokeWidth="0.5" />
          <Line x1="0" y1="-50" x2="0" y2="50" stroke={colors.neon} strokeWidth="0.5" />
          <Circle cx="0" cy="0" r="15" fill="none" stroke={colors.secondary} strokeWidth="2" />
          <Circle cx="0" cy="0" r="5" fill={colors.neon} />
          <Path d="M-40 -40 L-50 -50" stroke={colors.neon} strokeWidth="1" />
          <Path d="M40 40 L50 50" stroke={colors.neon} strokeWidth="1" />
          <Path d="M-40 40 L-50 50" stroke={colors.neon} strokeWidth="1" />
          <Path d="M40 -40 L50 -50" stroke={colors.neon} strokeWidth="1" />
        </G>
        
        {/* Mid-Left Blueprint Interface node */}
        <G transform="translate(80, 350)" opacity="0.3">
          <Circle cx="0" cy="0" r="60" fill="none" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="2 4" />
          <Circle cx="0" cy="0" r="45" fill="none" stroke={colors.secondary} strokeWidth="1" />
          <Circle cx="0" cy="0" r="30" fill="none" stroke={colors.neon} strokeWidth="2" opacity="0.5" />
          <Path d="M-60 0 L60 0" stroke={colors.secondary} strokeWidth="0.5" />
          <Path d="M0 -60 L0 60" stroke={colors.secondary} strokeWidth="0.5" />
          
          <Polygon points="0,-15 13,-7.5 13,7.5 0,15 -13,7.5 -13,-7.5" fill="none" stroke={colors.neon} strokeWidth="1" />
          <Circle cx="0" cy="0" r="2" fill={colors.neon} />
          
          {[...Array(8)].map((_, i) => (
             <Circle key={`mln-${i}`} cx={Math.cos((i * 45) * Math.PI / 180) * 45} cy={Math.sin((i * 45) * Math.PI / 180) * 45} r="2" fill={colors.secondary} />
          ))}
        </G>

        {/* Data Architecture & Matrix Lines */}
        <G transform="translate(50, 150)" opacity="0.5">
          <Rect x="0" y="0" width="80" height="2" fill={colors.neon} opacity="0.4" />
          <Rect x="0" y="8" width="150" height="1" fill={colors.secondary} opacity="0.3" />
          <Rect x="0" y="16" width="40" height="4" fill={colors.neon} opacity="0.2" />
          <Rect x="0" y="26" width="120" height="1" fill={colors.neon} opacity="0.5" strokeDasharray="2 2" />
          <Rect x="0" y="34" width="60" height="2" fill={colors.secondary} opacity="0.4" />
          <Rect x="0" y="42" width="200" height="1" fill={colors.neon} opacity="0.3" strokeDasharray="1 5" />
          
          <Circle cx="80" cy="1" r="2" fill={colors.neon} />
          <Circle cx="150" cy="8.5" r="1.5" fill={colors.secondary} />
          <Circle cx="120" cy="26.5" r="1" fill={colors.neon} />
          <Circle cx="60" cy="35" r="2" fill={colors.secondary} />
          <Circle cx="200" cy="42.5" r="2" fill={colors.neon} />
        </G>

        <G transform="translate(350, 650)" opacity="0.4">
          <Rect x="0" y="0" width="180" height="1" fill={colors.neon} opacity="0.4" />
          <Rect x="40" y="8" width="140" height="2" fill={colors.secondary} opacity="0.3" />
          <Rect x="80" y="16" width="100" height="1" fill={colors.neon} opacity="0.5" strokeDasharray="4 2" />
          <Rect x="120" y="24" width="60" height="3" fill={colors.neon} opacity="0.2" />
          <Rect x="160" y="32" width="40" height="1" fill={colors.secondary} opacity="0.5" />
          
          <Circle cx="0" cy="0.5" r="1.5" fill={colors.neon} />
          <Circle cx="40" cy="9" r="2" fill={colors.secondary} />
          <Circle cx="80" cy="16.5" r="1" fill={colors.neon} />
          <Circle cx="120" cy="25.5" r="2" fill={colors.secondary} />
        </G>

        {/* Abstract Fluid Splines */}
        <Path d="M 100 -50 Q 150 200 400 300 T 650 600" fill="none" stroke={colors.neon} strokeWidth="0.5" opacity="0.4" strokeDasharray="20 10 5 10" />
        <Path d="M 500 900 Q 400 600 200 500 T -50 200" fill="none" stroke={colors.secondary} strokeWidth="0.3" opacity="0.5" />
        <Path d="M 0 400 C 200 400, 300 200, 595 200" fill="none" stroke={colors.neon} strokeWidth="1" opacity="0.15" />
        <Path d="M 0 420 C 200 420, 300 220, 595 220" fill="none" stroke={colors.secondary} strokeWidth="0.2" opacity="0.3" />
        <Path d="M 0 440 C 200 440, 300 240, 595 240" fill="none" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="2 6" opacity="0.2" />

        {/* Circuit Nodes */}
        <G opacity="0.6">
          <Circle cx="120" cy="280" r="3" fill="none" stroke={colors.neon} strokeWidth="1" />
          <Circle cx="120" cy="280" r="1" fill={colors.secondary} />
          <Line x1="123" y1="280" x2="160" y2="280" stroke={colors.neon} strokeWidth="0.5" />
          <Line x1="160" y1="280" x2="180" y2="260" stroke={colors.neon} strokeWidth="0.5" />
          <Circle cx="180" cy="260" r="2" fill={colors.secondary} />
          <Line x1="180" y1="260" x2="220" y2="260" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="2 2" />
          <Circle cx="220" cy="260" r="1" fill={colors.neon} />

          <Circle cx="500" cy="450" r="4" fill="none" stroke={colors.secondary} strokeWidth="1" />
          <Circle cx="500" cy="450" r="1.5" fill={colors.neon} />
          <Line x1="496" y1="450" x2="450" y2="450" stroke={colors.secondary} strokeWidth="0.5" />
          <Line x1="450" y1="450" x2="420" y2="480" stroke={colors.secondary} strokeWidth="0.5" />
          <Circle cx="420" cy="480" r="2" fill={colors.neon} />
          <Line x1="420" y1="480" x2="420" y2="520" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="2 2" />
          <Circle cx="420" cy="520" r="1" fill={colors.secondary} />
          <Line x1="420" y1="520" x2="380" y2="560" stroke={colors.secondary} strokeWidth="0.5" />
          <Circle cx="380" cy="560" r="2" fill={colors.secondary} />
        </G>
        
        {/* Scattered Plus Signs */}
        {[...Array(20)].map((_, i) => {
           const x = (i * 97) % 595;
           const y = (i * 113) % 842;
           const isNeon = i % 2 === 0;
           return (
             <Path key={`plus-${i}`} d={`M${x-4} ${y} L${x+4} ${y} M${x} ${y-4} L${x} ${y+4}`} stroke={isNeon ? colors.neon : colors.secondary} strokeWidth={isNeon ? 0.5 : 1} opacity="0.4" />
           )
        })}
      </G>
      
      {/* Extreme Layering for Cover Variant */}
      {variant === 'cover' ? (
        <G>
          {/* Even more dynamic rings on Cover */}
          <G transform="translate(297.5, 421)" opacity="0.6">
            <Circle cx="0" cy="0" r="420" fill="none" stroke={colors.neon} strokeWidth="0.5" strokeDasharray="2 10 5 10" />
            <Circle cx="0" cy="0" r="450" fill="none" stroke={colors.secondary} strokeWidth="4" opacity="0.1" />
            <Circle cx="0" cy="0" r="480" fill="none" stroke={colors.neon} strokeWidth="1" strokeDasharray="1 15" opacity="0.5" />
            <Circle cx="0" cy="0" r="500" fill="none" stroke={colors.secondary} strokeWidth="0.5" strokeDasharray="20 40" opacity="0.3" />
            <Circle cx="0" cy="0" r="550" fill="none" stroke={colors.neon} strokeWidth="0.25" opacity="0.4" />
            
            {/* Target Reticles */}
            <Path d="M -440 0 L -460 0 M 440 0 L 460 0 M 0 -440 L 0 -460 M 0 440 L 0 460" stroke={colors.neon} strokeWidth="2" opacity="0.6" />
            <Path d="M -350 -350 L -365 -365 M 350 350 L 365 365 M -350 350 L -365 365 M 350 -350 L 365 -365" stroke={colors.secondary} strokeWidth="1" opacity="0.4" />
            <Path d="M -500 -500 L -520 -520 M 500 500 L 520 520 M -500 500 L -520 520 M 500 -500 L 520 -520" stroke={colors.neon} strokeWidth="0.5" opacity="0.5" />
            
            {/* Inner complex mechanisms */}
            <G opacity="0.4" transform="rotate(15)">
              <Polygon points="0,-150 130,-75 130,75 0,150 -130,75 -130,-75" fill="none" stroke={colors.secondary} strokeWidth="0.5" />
              <Polygon points="0,-120 104,-60 104,60 0,120 -104,60 -104,-60" fill="none" stroke={colors.neon} strokeWidth="1" strokeDasharray="5 5" />
              <Circle cx="0" cy="0" r="150" fill="none" stroke={colors.neon} strokeWidth="0.2" />
            </G>
            <G opacity="0.3" transform="rotate(-30)">
               <Rect x="-200" y="-200" width="400" height="400" fill="none" stroke={colors.secondary} strokeWidth="0.5" strokeDasharray="10 20" />
               <Circle cx="-200" cy="-200" r="5" fill={colors.neon} />
               <Circle cx="200" cy="-200" r="5" fill={colors.neon} />
               <Circle cx="-200" cy="200" r="5" fill={colors.neon} />
               <Circle cx="200" cy="200" r="5" fill={colors.neon} />
            </G>
          </G>

          {/* Random Interface Elements */}
          <G opacity="0.4">
             <Rect x="20" y="20" width="100" height="40" fill="none" stroke={colors.neon} strokeWidth="0.5" />
             <Rect x="20" y="65" width="20" height="5" fill={colors.neon} />
             <Rect x="45" y="65" width="50" height="5" fill={colors.secondary} />
             <Rect x="100" y="65" width="20" height="5" fill={colors.neon} opacity="0.5" />
             
             <Line x1="120" y1="40" x2="180" y2="40" stroke={colors.secondary} strokeWidth="1" strokeDasharray="2 4" />
             <Circle cx="185" cy="40" r="2" fill={colors.neon} />
             
             <Rect x="500" y="20" width="75" height="15" fill={colors.secondary} opacity="0.2" />
             <Rect x="500" y="40" width="50" height="2" fill={colors.neon} />
             <Rect x="500" y="45" width="60" height="2" fill={colors.neon} opacity="0.5" />
             <Rect x="500" y="50" width="40" height="2" fill={colors.secondary} />
             
             <Path d="M 500 70 L 500 120 L 550 120" fill="none" stroke={colors.neon} strokeWidth="0.5" />
             <Circle cx="550" cy="120" r="2" fill={colors.neon} />
             
             <G transform="translate(450, 750)">
               <Path d="M 0 0 L 20 -20 L 100 -20" fill="none" stroke={colors.neon} strokeWidth="1" />
               <Path d="M 0 5 L 20 -15 L 100 -15" fill="none" stroke={colors.secondary} strokeWidth="0.5" opacity="0.5" />
               <Circle cx="100" cy="-20" r="3" fill={colors.neon} />
               <Rect x="30" y="-35" width="60" height="10" fill={colors.secondary} opacity="0.1" />
               <Rect x="30" y="-35" width="60" height="10" fill="none" stroke={colors.neon} strokeWidth="0.2" />
             </G>
             
             {/* Corner brackets */}
             <Path d="M 20 800 L 20 820 L 40 820" fill="none" stroke={colors.neon} strokeWidth="2" opacity="0.6" />
             <Path d="M 575 800 L 575 820 L 555 820" fill="none" stroke={colors.neon} strokeWidth="2" opacity="0.6" />
             <Path d="M 20 200 L 20 180 L 40 180" fill="none" stroke={colors.neon} strokeWidth="2" opacity="0.6" />
             
             {/* Scattered floating squares */}
             {[...Array(15)].map((_, i) => {
               const x = (i * 123) % 595;
               const y = (i * 321) % 842;
               return <Rect key={`fs-${i}`} x={x} y={y} width="4" height="4" fill="none" stroke={colors.neon} strokeWidth="0.5" opacity="0.4" />
             })}
          </G>
        </G>
      ) : <Path d="" />}
    </Svg>
  );
};




const UltimateTableOfContents = ({ documents, docColors }: { documents: PdfDocument[], docColors: any }) => {
  return (
    <Page size="A4" style={{ backgroundColor: '#ffffff', padding: 60, position: 'relative' }}>
        <UltimateBackgroundGraphics colors={docColors} variant="toc" />
        <View style={{ marginBottom: 40, marginTop: 40 }}>
           <Text style={{ fontSize: 32, fontFamily: 'Inter', fontWeight: 700, color: '#0f172a', letterSpacing: -1 }}>Contents</Text>
           <View style={{ height: 3, width: 60, backgroundColor: docColors.neon, marginTop: 12, borderRadius: 1.5 }} />
        </View>
        <View style={{ flex: 1 }}>
          {documents.map((doc, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 }}>
               <Text style={{ width: 24, fontSize: 12, fontFamily: 'Space Mono', color: docColors.secondary, fontWeight: 700 }}>{(idx + 1).toString().padStart(2, '0')}</Text>
               <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter', fontWeight: 500, color: '#334155' }}>{doc.title}</Text>
               {doc.group ? <Text style={{ fontSize: 10, fontFamily: 'Space Mono', color: '#64748b', marginLeft: 16 }}>{doc.group}</Text> : <View style={{ width: 0 }} />}
            </View>
          ))}
        </View>
    </Page>
  );
}

export const ReactPdfOutputUltimate = ({ 
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
    }
    return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
  };

  const adjustColorWithAlpha = (color: string, factor: number, alpha: number) => {
    const { r, g, b } = parseColorToRgb(color);
    return `rgba(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)}, ${alpha})`;
  };

  const getColorsForDoc = (groupName?: string) => {
    const groupsOrder = Array.from(new Set(documents.map(d => d.group || "Ungrouped")));
    const gIdx = groupsOrder.indexOf(groupName || "Ungrouped");
    const colorNameRaw = colorSequence[gIdx % colorSequence.length] || themeColor || 'indigo';
    let colorName = colorNameRaw;
    if (colorName.startsWith('custom-')) {
      colorName = '#' + colorName.replace('custom-', '');
    }
    
    let neon = "#4f46e5";
    let secondary = "#c084fc"; // fallback 

    if (colorName.startsWith('#') || colorName.startsWith('rgb') || colorName.startsWith('hsl')) {
       neon = colorName;
    } else {
       const customTheme = THEMES.find(t => t.id === colorName);
       if (customTheme && customTheme.colors && customTheme.colors.length > 0) {
           const extractColor = (cStr: string, defaultColor: string) => {
             const hexMatch = cStr.match(/#([a-fA-F0-9]{3,6})/);
             if (hexMatch) return hexMatch[0];
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
           if (customTheme.colors[1]) secondary = extractColor(customTheme.colors[1], secondary);
       } else {
           const tailwindColors: Record<string, string> = {
             red: "#ef4444", blue: "#3b82f6", green: "#22c55e", 
             yellow: "#eab308", purple: "#a855f7", pink: "#ec4899", 
             indigo: "#6366f1", teal: "#14b8a6", orange: "#f97316",
             cyan: "#06b6d4", lime: "#84cc16", amber: "#f59e0b",
             emerald: "#10b981", fuchsia: "#d946ef", rose: "#f43f5e",
             slate: "#64748b", zinc: "#71717a"
           };
           const baseColorName = colorName.split('-')[0];
           neon = tailwindColors[baseColorName] || tailwindColors['indigo'];
       }
    }

    return { 
      neon, 
      secondary,
      border: adjustColorWithAlpha(neon, 1.0, 0.4), 
      bgLight: adjustColorWithAlpha(neon, 1.0, 0.08)
    };
  };

  const tColors = getColorsForDoc(documents[0]?.group || "Ungrouped");

  return (
    <Document title="Document Export" author="System">
      {includeCover ? (
        <Page key="cover" size="A4" style={{ backgroundColor: '#ffffff', position: 'relative' }}>
          <UltimateBackgroundGraphics colors={tColors} variant="cover" />
          
          <View style={{ flex: 1, padding: 60, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '100%', alignItems: 'center', backgroundColor: '#ffffff', padding: 60, borderRadius: 32, borderWidth: 1, borderColor: '#e2e8f0', position: 'relative' }}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 6, backgroundColor: tColors.bgLight, borderRadius: 20, marginBottom: 32, borderWidth: 1, borderColor: tColors.border }}>
                  <Text style={{ color: tColors.neon, fontSize: 10, fontFamily: 'Space Mono', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Ultimate Edition</Text>
              </View>

              <Text style={{ fontSize: 48, color: '#0f172a', fontFamily: 'Inter', fontWeight: 700, lineHeight: 1.1, textAlign: 'center', marginBottom: 24, letterSpacing: -1 }}>
                {documents.length > 0 ? documents[0].title : 'System Log'}
              </Text>
              
              {(documents[0] as any)?.metadata?.description ? (
                <Text style={{ fontSize: 14, color: '#475569', fontFamily: 'Inter', lineHeight: 1.6, textAlign: 'center', maxWidth: '80%' }}>
                   {(documents[0] as any).metadata.description}
                </Text>
              ) : <View style={{ height: 20 }} />}
            </View>
          </View>
        </Page>
      ) : []}

      {includeToc && documents.length > 1 ? (
          <UltimateTableOfContents key="toc" documents={documents} docColors={tColors} />
      ) : false}

      {documents.map((doc, dIdx) => {
        const dColors = getColorsForDoc(doc.group || "Ungrouped");
        return (
            <Page key={`doc-${dIdx}`} size="A4" style={{ backgroundColor: '#ffffff', padding: 60, paddingBottom: 80, position: 'relative' }}>
            <UltimateBackgroundGraphics colors={dColors} />
            
            <View style={{ marginBottom: 48 }}>
                {doc.group ? (
                    <Text style={{ fontSize: 12, fontFamily: 'Space Mono', color: dColors.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
                        {doc.group}
                    </Text>
                ) : <View style={{ height: 12 }} />}
                <Text style={{ fontSize: 36, color: '#0f172a', fontFamily: 'Inter', fontWeight: 700, letterSpacing: -1, lineHeight: 1.1 }}>
                    {doc.title || 'Untitled'}
                </Text>
            </View>

            {doc.blocks.map((block, bIdx) => (
                <UltimateBlockRenderer key={bIdx} block={block} docColors={dColors} isExam={isExam} />
            ))}

            <View fixed style={{ position: 'absolute', bottom: 30, left: 60, right: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: 1 }} render={({ pageNumber, totalPages }) => `${pageNumber} // ${totalPages}`} />
            </View>
            </Page>
        );
      })}
    </Document>
  );
};

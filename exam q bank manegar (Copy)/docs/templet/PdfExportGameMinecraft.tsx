import React from 'react';
import { PdfDocument, PdfBlock } from '../../types';
import { Document, Page, Text, View, Image, Svg, Path, Line, Circle, Rect, Polygon, Font } from '@react-pdf/renderer';

// Register Pixel fonts
Font.register({
  family: 'Press Start 2P',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK0nS.ttf', fontWeight: 400 },
  ]
});

Font.register({
  family: 'VT323',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/vt323/v18/pxiKyp0ihIEF2hsY.ttf', fontWeight: 400 },
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
const getTitleFontFamily = (text: string) => isArabic(text) ? 'Cairo' : 'Press Start 2P';
const getBodyFontFamily = (text: string) => isArabic(text) ? 'Cairo' : 'VT323';

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

const MinecraftRichText = ({ text, baseStyle }: { text: string; baseStyle: any }): any => {
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
          color: baseStyle?.color || '#3f3f3f',
          fontFamily: getBodyFontFamily(part)
        };

        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
          const content = part.slice(2, -2);
          return <MinecraftRichText key={i} text={content} baseStyle={{ ...style, color: '#000000' }} />;
        } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
          const content = part.slice(1, -1);
          return <MinecraftRichText key={i} text={content} baseStyle={{ ...style, color: '#555555' }} />;
        } else if (part.startsWith('==') && part.endsWith('==')) {
          const content = part.slice(2, -2);
          return <MinecraftRichText key={i} text={content} baseStyle={{ ...style, backgroundColor: '#FFFF55', color: '#000000' }} />;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          const content = part.slice(1, -1);
          style.color = '#55FF55';
          style.backgroundColor = '#000000';
          return <Text key={i} style={style}>{content}</Text>;
        } else if (part.startsWith('@@') && part.endsWith('@@')) {
          const innerText = part.slice(2, -2);
          const photoParts = innerText.split('|');
          const caption = photoParts[0];
          style.color = '#55FFFF';
          style.backgroundColor = '#000000';
          return <Text key={i} style={style}>{`[IMG: ${caption.trim()}]`}</Text>;
        }

        return <Text key={i} style={style}>{part}</Text>;
      })}
    </Text>
  );
};

// Colors from Minecraft Inventory UI
const MC_COLORS = {
  bg: '#C6C6C6',
  borderLight: '#FFFFFF',
  borderDark: '#555555',
  borderDarker: '#000000', // Outer boundary sometimes
  text: '#3F3F3F',
  textShadow: '#A0A0A0',
  title: '#404040',
  green: '#55FF55'
};

const MinecraftBox = ({ children, style }: { children: any, style?: any }) => (
  // We use borders to simulate the 3D bevel. 
  <View style={{
    backgroundColor: MC_COLORS.bg,
    borderWidth: 3,
    borderTopColor: MC_COLORS.borderLight,
    borderLeftColor: MC_COLORS.borderLight,
    borderBottomColor: MC_COLORS.borderDark,
    borderRightColor: MC_COLORS.borderDark,
    ...style
  }}>
    {children}
  </View>
);

const MinecraftInsetBox = ({ children, style }: { children: any, style?: any }) => (
  // Inset Box: dark top/left, light bottom/right
  <View style={{
    backgroundColor: '#8B8B8B',
    borderWidth: 3,
    borderTopColor: MC_COLORS.borderDarker || '#373737',
    borderLeftColor: MC_COLORS.borderDarker || '#373737',
    borderBottomColor: MC_COLORS.borderLight,
    borderRightColor: MC_COLORS.borderLight,
    ...style
  }}>
    {children}
  </View>
);

const MinecraftBackground = ({ overlay = false }: { overlay?: boolean }) => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
    {/* Sky */}
    <Rect x="0" y="0" width="595" height="842" fill="#78A7FF" />
    
    {/* Sun */}
    <Rect x="450" y="80" width="60" height="60" fill="#FFDF00" />
    <Rect x="440" y="90" width="80" height="40" fill="#FFDF00" />
    <Rect x="460" y="70" width="40" height="80" fill="#FFDF00" />

    {/* Clouds */}
    <Rect x="80" y="120" width="100" height="30" fill="#FFFFFF" />
    <Rect x="100" y="100" width="80" height="20" fill="#FFFFFF" />
    <Rect x="120" y="150" width="80" height="20" fill="#FFFFFF" />
    
    <Rect x="350" y="200" width="120" height="40" fill="#FFFFFF" />
    <Rect x="370" y="180" width="80" height="20" fill="#FFFFFF" />
    <Rect x="430" y="240" width="60" height="20" fill="#FFFFFF" />

    {/* Distant Hills / Background elements */}
    <Rect x="0" y="440" width="150" height="200" fill="#6DA64F" />
    <Rect x="100" y="380" width="180" height="200" fill="#5D9240" />
    <Rect x="350" y="420" width="250" height="200" fill="#6DA64F" />

    {/* Ground layer */}
    {/* Dirt fill underneath everything */}
    <Rect x="0" y="550" width="595" height="300" fill="#866043" />
    
    {/* Terrain geometry */}
    <Rect x="100" y="520" width="200" height="30" fill="#866043" />
    <Rect x="350" y="480" width="150" height="70" fill="#866043" />
    <Rect x="500" y="500" width="95" height="50" fill="#866043" />
    <Rect x="0" y="500" width="60" height="50" fill="#866043" />

    {/* Grass top layer */}
    <Rect x="0" y="500" width="60" height="20" fill="#5DBF4B" />
    <Rect x="60" y="550" width="40" height="20" fill="#5DBF4B" />
    <Rect x="100" y="520" width="200" height="20" fill="#5DBF4B" />
    <Rect x="300" y="550" width="50" height="20" fill="#5DBF4B" />
    <Rect x="350" y="480" width="150" height="20" fill="#5DBF4B" />
    <Rect x="500" y="500" width="95" height="20" fill="#5DBF4B" />
    
    {/* Some dangling 'dirt' chunks or textures below grass */}
    <Rect x="10" y="520" width="20" height="10" fill="#6F4D32" />
    <Rect x="120" y="540" width="30" height="15" fill="#6F4D32" />
    <Rect x="200" y="550" width="20" height="10" fill="#6F4D32" />
    <Rect x="380" y="500" width="25" height="20" fill="#6F4D32" />
    <Rect x="450" y="510" width="20" height="15" fill="#6F4D32" />

    {/* Tree 1 */}
    <Rect x="150" y="440" width="20" height="80" fill="#5C4033" />
    <Rect x="110" y="400" width="100" height="40" fill="#3A8A24" />
    <Rect x="130" y="380" width="60" height="20" fill="#3A8A24" />
    <Rect x="130" y="360" width="40" height="20" fill="#3A8A24" />

    {/* Tree 2 */}
    <Rect x="420" y="420" width="20" height="60" fill="#5C4033" />
    <Rect x="390" y="370" width="80" height="50" fill="#3A8A24" />
    <Rect x="410" y="350" width="40" height="20" fill="#3A8A24" />
    <Rect x="380" y="390" width="20" height="20" fill="#3A8A24" />

    {/* Stone layer */}
    <Rect x="0" y="650" width="595" height="192" fill="#7D7D7D" />
    
    {/* Cave/Holes in the stone */}
    <Rect x="40" y="680" width="80" height="60" fill="#555555" />
    <Rect x="60" y="700" width="100" height="40" fill="#333333" />
    <Rect x="300" y="720" width="150" height="80" fill="#555555" />
    <Rect x="350" y="750" width="50" height="50" fill="#333333" />
    
    {/* Ores */}
    {/* Coal */}
    <Rect x="200" y="680" width="10" height="10" fill="#111111" />
    <Rect x="210" y="670" width="10" height="10" fill="#111111" />
    <Rect x="190" y="690" width="10" height="10" fill="#111111" />
    
    {/* Gold */}
    <Rect x="480" y="690" width="10" height="10" fill="#FCEE4B" />
    <Rect x="470" y="700" width="10" height="10" fill="#FCEE4B" />
    <Rect x="490" y="710" width="10" height="10" fill="#FCEE4B" />
    
    {/* Diamond */}
    <Rect x="150" y="800" width="10" height="10" fill="#55FFFF" />
    <Rect x="160" y="790" width="10" height="10" fill="#55FFFF" />
    <Rect x="170" y="810" width="10" height="10" fill="#55FFFF" />

    {overlay ? <Rect x="0" y="0" width="595" height="842" fill="#000000" fillOpacity="0.65" /> : <Rect x="0" y="0" width="0" height="0" />}
  </Svg>
);

const NetherBackground = ({ overlay = false }: { overlay?: boolean }) => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
    {/* Base Netherrack red */}
    <Rect x="0" y="0" width="595" height="842" fill="#500000" />
    
    {/* Lava sea */}
    <Rect x="0" y="700" width="595" height="142" fill="#FF5500" />
    <Rect x="0" y="710" width="595" height="10" fill="#FFAA00" />
    <Rect x="50" y="720" width="100" height="10" fill="#FFFF55" />
    <Rect x="300" y="730" width="80" height="10" fill="#FFFF55" />
    <Rect x="150" y="760" width="120" height="10" fill="#FFAA00" />
    <Rect x="400" y="780" width="90" height="10" fill="#FFFF55" />
    
    {/* Netherrack pillars */}
    <Rect x="50" y="0" width="80" height="842" fill="#3D0000" />
    <Rect x="70" y="0" width="40" height="842" fill="#660000" />
    <Rect x="450" y="0" width="100" height="400" fill="#440000" />
    <Rect x="400" y="550" width="150" height="292" fill="#440000" />
    <Rect x="250" y="-50" width="120" height="200" fill="#3D0000" />
    
    {/* Lava falls */}
    <Rect x="480" y="0" width="30" height="700" fill="#FF5500" />
    <Rect x="490" y="0" width="10" height="700" fill="#FFFF55" />
    
    <Rect x="280" y="0" width="20" height="150" fill="#FF5500" />
    <Rect x="285" y="0" width="10" height="150" fill="#FFFF55" />
    
    {/* Glowstone */}
    <Rect x="200" y="50" width="40" height="30" fill="#FFFF55" />
    <Rect x="210" y="40" width="20" height="50" fill="#FFFF55" />
    <Rect x="220" y="60" width="10" height="30" fill="#FFFFCC" />

    <Rect x="150" y="150" width="20" height="20" fill="#FFFF55" />
    <Rect x="400" y="300" width="30" height="40" fill="#FFFF55" />

    {/* Random Netherrack textures / soulsand */}
    <Rect x="250" y="300" width="20" height="20" fill="#770000" />
    <Rect x="280" y="350" width="40" height="20" fill="#330000" />
    <Rect x="300" y="600" width="30" height="30" fill="#660000" />
    <Rect x="0" y="200" width="50" height="50" fill="#660000" />
    <Rect x="80" y="400" width="20" height="20" fill="#220000" />
    <Rect x="450" y="600" width="60" height="20" fill="#220000" />

    {/* Fire particles */}
    <Rect x="350" y="650" width="4" height="4" fill="#FFAA00" />
    <Rect x="370" y="630" width="4" height="4" fill="#FF5500" />
    <Rect x="200" y="680" width="4" height="4" fill="#FFFF55" />
    <Rect x="50" y="600" width="4" height="4" fill="#FF5500" />

    {overlay && <Rect x="0" y="0" width="595" height="842" fill="#000000" fillOpacity="0.65" />}
  </Svg>
);

const EndBackground = ({ overlay = false }: { overlay?: boolean }) => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
    {/* Void */}
    <Rect x="0" y="0" width="595" height="842" fill="#0A0014" />
    
    {/* Stars / Static in the End */}
    {Array.from({ length: 40 }).map((_, i) => (
      <Rect key={i} x={Math.random() * 595} y={Math.random() * 842} width="4" height="4" fill={Math.random() > 0.5 ? "#AA55FF" : "#FFFFFF"} fillOpacity={Math.random() * 0.8 + 0.2} />
    ))}
    
    {/* Main End Island */}
    <Rect x="70" y="600" width="455" height="150" fill="#E6E6B8" />
    <Rect x="90" y="750" width="415" height="40" fill="#CCCC99" />
    <Rect x="120" y="790" width="355" height="52" fill="#B3B380" />
    
    {/* End Stone Texture */}
    <Rect x="150" y="600" width="30" height="20" fill="#FFFFCC" />
    <Rect x="250" y="620" width="40" height="20" fill="#CCCC99" />
    <Rect x="350" y="610" width="20" height="20" fill="#FFFFCC" />
    <Rect x="420" y="640" width="50" height="20" fill="#CCCC99" />
    <Rect x="100" y="650" width="40" height="30" fill="#CCCC99" />
    <Rect x="200" y="660" width="20" height="20" fill="#FFFFCC" />
    <Rect x="300" y="680" width="60" height="20" fill="#B3B380" />
    <Rect x="450" y="700" width="30" height="20" fill="#FFFFCC" />

    {/* Floating Islands */}
    <Rect x="-20" y="200" width="100" height="40" fill="#E6E6B8" />
    <Rect x="0" y="240" width="60" height="20" fill="#B3B380" />
    <Rect x="-10" y="260" width="30" height="20" fill="#999966" />
    
    <Rect x="480" y="350" width="150" height="60" fill="#E6E6B8" />
    <Rect x="500" y="410" width="100" height="30" fill="#CCCC99" />
    <Rect x="520" y="440" width="60" height="20" fill="#B3B380" />

    {/* Obsidian Pillar 1 */}
    <Rect x="180" y="400" width="40" height="200" fill="#1A0033" />
    <Rect x="190" y="400" width="20" height="200" fill="#2E004D" />
    {/* End Crystal 1 */}
    <Rect x="195" y="370" width="10" height="20" fill="#FF55FF" />
    <Rect x="190" y="380" width="20" height="10" fill="#FF55FF" />
    <Rect x="195" y="375" width="10" height="10" fill="#FFFFFF" />
    <Rect x="180" y="390" width="40" height="10" fill="#555555" /> {/* Bedrock base */}

    {/* Obsidian Pillar 2 */}
    <Rect x="380" y="450" width="60" height="150" fill="#1A0033" />
    <Rect x="395" y="450" width="30" height="150" fill="#2E004D" />
    {/* End Crystal 2 */}
    <Rect x="405" y="420" width="10" height="20" fill="#FF55FF" />
    <Rect x="400" y="430" width="20" height="10" fill="#FF55FF" />
    <Rect x="405" y="425" width="10" height="10" fill="#FFFFFF" />
    <Rect x="390" y="440" width="40" height="10" fill="#555555" /> {/* Bedrock base */}

    {/* Obsidian Pillar 3 (Tall one in background) */}
    <Rect x="280" y="250" width="30" height="350" fill="#0D001A" />
    <Rect x="290" y="250" width="10" height="350" fill="#1A0033" />
    <Rect x="270" y="240" width="50" height="10" fill="#555555" />
    <Rect x="290" y="220" width="10" height="20" fill="#FF55FF" />
    <Rect x="285" y="225" width="20" height="10" fill="#FF55FF" />
    <Rect x="290" y="225" width="10" height="10" fill="#FFFFFF" />
    
    {/* Ender Dragon silhouette (very subtle in background) */}
    <Rect x="300" y="100" width="80" height="20" fill="#05000A" />
    <Rect x="320" y="90" width="40" height="40" fill="#05000A" />
    <Polygon points="380,110 420,80 380,120" fill="#05000A" />
    <Polygon points="300,110 260,80 300,120" fill="#05000A" />

    {overlay && <Rect x="0" y="0" width="595" height="842" fill="#000000" fillOpacity="0.65" />}
  </Svg>
);

const OceanBackground = ({ overlay = false }: { overlay?: boolean }) => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
    <Rect x="0" y="0" width="595" height="842" fill="#0A2A59" />
    <Rect x="0" y="0" width="595" height="200" fill="#154B9A" />
    <Rect x="0" y="200" width="595" height="200" fill="#103A7A" />
    <Rect x="0" y="400" width="595" height="200" fill="#0C2F63" />
    <Rect x="50" y="500" width="10" height="400" fill="#2E6B34" />
    <Rect x="45" y="520" width="20" height="10" fill="#2E6B34" />
    <Rect x="55" y="600" width="20" height="10" fill="#2E6B34" />
    <Rect x="450" y="300" width="10" height="600" fill="#1C4521" />
    <Rect x="445" y="350" width="20" height="10" fill="#1C4521" />
    <Rect x="455" y="450" width="20" height="10" fill="#1C4521" />
    <Rect x="250" y="600" width="10" height="300" fill="#26592B" />
    <Rect x="55" y="480" width="6" height="6" fill="#80B3FF" fillOpacity="0.6" />
    <Rect x="50" y="450" width="8" height="8" fill="#80B3FF" fillOpacity="0.6" />
    <Rect x="450" y="280" width="6" height="6" fill="#80B3FF" fillOpacity="0.6" />
    <Rect x="460" y="250" width="10" height="10" fill="#80B3FF" fillOpacity="0.6" />
    <Rect x="250" y="580" width="6" height="6" fill="#80B3FF" fillOpacity="0.6" />
    <Rect x="0" y="780" width="595" height="62" fill="#E2DBAD" />
    <Rect x="0" y="760" width="150" height="20" fill="#E2DBAD" />
    <Rect x="300" y="770" width="200" height="10" fill="#E2DBAD" />
    {overlay && <Rect x="0" y="0" width="595" height="842" fill="#000000" fillOpacity="0.65" />}
  </Svg>
);

const MinesBackground = ({ overlay = false }: { overlay?: boolean }) => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} viewBox="0 0 595 842">
    <Rect x="0" y="0" width="595" height="842" fill="#666666" />
    <Rect x="40" y="50" width="30" height="30" fill="#555555" />
    <Rect x="150" y="120" width="40" height="40" fill="#777777" />
    <Rect x="300" y="80" width="20" height="20" fill="#555555" />
    <Rect x="450" y="200" width="50" height="50" fill="#777777" />
    <Rect x="100" y="300" width="35" height="35" fill="#555555" />
    <Rect x="250" y="400" width="45" height="45" fill="#777777" />
    <Rect x="500" y="350" width="25" height="25" fill="#555555" />
    <Rect x="80" y="550" width="40" height="40" fill="#777777" />
    <Rect x="350" y="600" width="30" height="30" fill="#555555" />
    <Rect x="420" y="700" width="50" height="50" fill="#777777" />
    <Rect x="100" y="200" width="15" height="15" fill="#111111" />
    <Rect x="115" y="185" width="15" height="15" fill="#111111" />
    <Rect x="130" y="200" width="15" height="15" fill="#111111" />
    <Rect x="400" y="500" width="15" height="15" fill="#D8D8D8" />
    <Rect x="415" y="485" width="15" height="15" fill="#D8D8D8" />
    <Rect x="385" y="515" width="15" height="15" fill="#D8D8D8" />
    <Rect x="200" y="700" width="15" height="15" fill="#FCEE4B" />
    <Rect x="215" y="715" width="15" height="15" fill="#FCEE4B" />
    <Rect x="500" y="750" width="15" height="15" fill="#55FFFF" />
    <Rect x="50" y="600" width="15" height="15" fill="#AA0000" />
    <Rect x="65" y="615" width="15" height="15" fill="#AA0000" />
    <Rect x="80" y="0" width="30" height="842" fill="#5C4033" />
    <Rect x="480" y="0" width="30" height="842" fill="#5C4033" />
    <Rect x="0" y="150" width="595" height="30" fill="#5C4033" />
    <Rect x="0" y="650" width="595" height="30" fill="#5C4033" />
    {overlay && <Rect x="0" y="0" width="595" height="842" fill="#000000" fillOpacity="0.65" />}
  </Svg>
);

const WaterBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#154B9A', borderWidth: 3, borderTopColor: '#3F76E4', borderLeftColor: '#3F76E4', borderBottomColor: '#0C2F63', borderRightColor: '#0C2F63', ...style }}>{children}</View>
);

const NetherBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#3D0000', borderWidth: 3, borderTopColor: '#FF5500', borderLeftColor: '#FF5500', borderBottomColor: '#330000', borderRightColor: '#330000', ...style }}>{children}</View>
);

const EndBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#E6E6B8', borderWidth: 3, borderTopColor: '#FFFFCC', borderLeftColor: '#FFFFCC', borderBottomColor: '#B3B380', borderRightColor: '#B3B380', ...style }}>{children}</View>
);

const GrassBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#5DBF4B', borderWidth: 3, borderTopColor: '#866043', borderLeftColor: '#866043', borderBottomColor: '#4A3320', borderRightColor: '#4A3320', ...style }}>{children}</View>
);

const MineBox = ({ children, style }: { children: any, style?: any }) => (
  <View style={{ backgroundColor: '#666666', borderWidth: 3, borderTopColor: '#888888', borderLeftColor: '#888888', borderBottomColor: '#444444', borderRightColor: '#444444', ...style }}>{children}</View>
);

const GameMinecraftBlockRenderer = ({ block, docColors, isExam }: { block: PdfBlock, docColors: any, isExam: boolean }) => {
  if (!block) return <View />;
  const content = block.content || '';
  const isRtl = isArabic(prepareInteractiveSyntax(content));

  switch (block.type) {
    case 'heading':
      return (
        <View wrap={false} style={{ marginBottom: 20, marginTop: 32, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
          <Text style={{ fontSize: 16, fontFamily: getTitleFontFamily(content), color: MC_COLORS.title }}>
            {content}
          </Text>
        </View>
      );
    case 'subheading':
      return (
        <View wrap={false} style={{ marginTop: 24, marginBottom: 12, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
          <Text style={{ fontSize: 12, fontFamily: getTitleFontFamily(content), color: MC_COLORS.title }}>
            {content}
          </Text>
        </View>
      );
    case 'subtitle':
      return (
        <View wrap={false} style={{ marginTop: 12, marginBottom: 8, alignSelf: isRtl ? 'flex-end' : 'flex-start', borderBottomWidth: 2, borderBottomColor: MC_COLORS.borderDark }}>
          <Text style={{ fontSize: 14, fontFamily: 'VT323', color: MC_COLORS.title }}>
            {content}
          </Text>
        </View>
      );
    case 'paragraph':
    case 'text':
    case 'plain':
      if (content.trim() === '') return <View style={{ height: 10 }} />;
      return (
        <View style={{ marginBottom: 12 }}>
          <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', lineHeight: 1.2, color: MC_COLORS.text, textAlign: isRtl ? 'right' : 'left' }} />
        </View>
      );
    case 'example': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 12 }}>
          <WaterBox style={{ padding: 12 }}>
            <Text style={{ fontSize: 10, color: '#55FFFF', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>Example (Ocean)</Text>
            <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#FFFFFF', lineHeight: 1.2, textAlign: isBoxRtl ? 'right' : 'left' }} />
          </WaterBox>
        </View>
      );
    }
    case 'explanation': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 12 }}>
          <MineBox style={{ padding: 12 }}>
            <Text style={{ fontSize: 10, color: '#FFFF55', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>Explanation (Mines)</Text>
            <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#FFFFFF', lineHeight: 1.2, textAlign: isBoxRtl ? 'right' : 'left' }} />
          </MineBox>
        </View>
      );
    }
    case 'note': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 12 }}>
          <EndBox style={{ padding: 12 }}>
            <Text style={{ fontSize: 10, color: '#AA00AA', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>Note (The End)</Text>
            <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#000000', lineHeight: 1.2, textAlign: isBoxRtl ? 'right' : 'left' }} />
          </EndBox>
        </View>
      );
    }
    case 'warning': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 12 }}>
          <NetherBox style={{ padding: 12 }}>
             <Text style={{ fontSize: 10, color: '#FFAA00', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>Warning (Nether)</Text>
             <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#FFFFFF', fontWeight: 700, lineHeight: 1.2, textAlign: isBoxRtl ? 'right' : 'left' }} />
          </NetherBox>
        </View>
      );
    }
    case 'tip': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 12 }}>
          <GrassBox style={{ padding: 12 }}>
             <Text style={{ fontSize: 10, color: '#FFFFFF', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>Tip (Overworld)</Text>
             <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#FFFFFF', lineHeight: 1.2, textAlign: isBoxRtl ? 'right' : 'left' }} />
          </GrassBox>
        </View>
      );
    }
    case 'high_yield': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 12 }}>
          <MinecraftBox style={{ padding: 12, backgroundColor: '#AA00AA' }}>
            <Text style={{ fontSize: 10, color: '#FF55FF', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>High Yield</Text>
            <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#FFFFFF', lineHeight: 1.2, textAlign: isBoxRtl ? 'right' : 'left' }} />
          </MinecraftBox>
        </View>
      );
    }
    case 'clinical_correlation': {
      const isBoxRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 12 }}>
          <MinecraftBox style={{ padding: 12, backgroundColor: '#55FFFF' }}>
            <Text style={{ fontSize: 10, color: '#00AAAA', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>Clinical</Text>
            <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#000000', lineHeight: 1.2, textAlign: isBoxRtl ? 'right' : 'left' }} />
          </MinecraftBox>
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
                <View style={{ width: 24, alignItems: 'center', justifyContent: 'flex-start' }}>
                  {isOrdered ? (
                    <Text style={{ fontSize: 15, color: MC_COLORS.text, fontFamily: 'VT323' }}>{i + 1}.</Text>
                  ) : (
                    <Text style={{ fontSize: 15, color: '#555555', fontFamily: 'VT323' }}>-</Text>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: isItemRtl ? 0 : 8, marginRight: isItemRtl ? 8 : 0 }}>
                  <MinecraftRichText text={item} baseStyle={{ fontSize: 15, fontFamily: 'VT323', lineHeight: 1.2, color: MC_COLORS.text, textAlign: isItemRtl ? 'right' : 'left' }} />
                </View>
              </View>
            );
          })}
        </View>
      );
    case 'step':
      return (
        <View style={{ marginVertical: 16, flexDirection: 'column' }}>
          {(block.items || []).map((item, i) => {
            const isItemRtl = isArabic(prepareInteractiveSyntax(item));
            return (
              <View wrap={false} key={i} style={{ flexDirection: isItemRtl ? 'row-reverse' : 'row', marginBottom: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 32, height: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: '#55FF55', borderWidth: 2, borderTopColor: '#AAFFAA', borderLeftColor: '#AAFFAA', borderBottomColor: '#00AA00', borderRightColor: '#00AA00', marginLeft: isItemRtl ? 12 : 0, marginRight: isItemRtl ? 0 : 12 }}>
                  <Text style={{ color: '#000000', fontSize: 14, fontFamily: 'Press Start 2P', marginTop: 3 }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <MinecraftBox style={{ padding: 12 }}>
                    <MinecraftRichText text={item} baseStyle={{ fontSize: 15, fontFamily: 'VT323', lineHeight: 1.2, color: MC_COLORS.text, textAlign: isItemRtl ? 'right' : 'left' }} />
                  </MinecraftBox>
                </View>
              </View>
            );
          })}
        </View>
      );
    case 'quote':
      const isQuoteRtl = isArabic(prepareInteractiveSyntax(content));
      return (
        <View wrap={false} style={{ marginVertical: 16, padding: 16, borderLeftWidth: isQuoteRtl ? 0 : 4, borderRightWidth: isQuoteRtl ? 4 : 0, borderColor: '#555555' }}>
          <MinecraftRichText text={`" ${content} "`} baseStyle={{ fontSize: 16, fontFamily: 'VT323', color: '#555555', textAlign: isQuoteRtl ? 'right' : 'left', lineHeight: 1.2 }} />
        </View>
      );
    case 'vocabulary':
      const vocabIsRtl = isArabic(prepareInteractiveSyntax(block.term || '') + prepareInteractiveSyntax(block.definition || ''));
      return (
        <MinecraftBox style={{ marginVertical: 12, padding: 12, flexDirection: vocabIsRtl ? 'row-reverse' : 'column' }}>
          <View style={{ marginBottom: 4 }}>
            <MinecraftRichText text={block.term || ''} baseStyle={{ fontFamily: 'Press Start 2P', fontSize: 10, color: '#5555FF', textAlign: vocabIsRtl ? 'right' : 'left' }} />
          </View>
          <View>
            <MinecraftRichText text={block.definition || ''} baseStyle={{ fontFamily: 'VT323', fontSize: 15, lineHeight: 1.2, color: MC_COLORS.text, textAlign: vocabIsRtl ? 'right' : 'left' }} />
          </View>
        </MinecraftBox>
      );
    case 'code':
      return (
        <View wrap={false} style={{ marginVertical: 12 }}>
          <MinecraftInsetBox style={{ padding: 16, backgroundColor: '#000000' }}>
            <Text style={{ fontFamily: 'VT323', fontSize: 14, color: '#55FF55', lineHeight: 1.2 }}>
              {content}
            </Text>
          </MinecraftInsetBox>
        </View>
      );
    case 'summary':
      return (
        <View wrap={false} style={{ marginVertical: 20 }}>
          <MinecraftBox style={{ padding: 16, backgroundColor: '#FFFF55' }}>
            <Text style={{ fontSize: 12, color: '#000000', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>Summary</Text>
            <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#000000', lineHeight: 1.2 }} />
          </MinecraftBox>
        </View>
      );
    case 'reference':
      return (
        <View wrap={false} style={{ marginVertical: 8, padding: 8 }}>
          <Text style={{ fontSize: 12, fontFamily: 'VT323', color: '#555555' }}>
            REF: {content}
          </Text>
        </View>
      );
    case 'dialogue':
      return (
        <View wrap={false} style={{ marginVertical: 12, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#000000', alignSelf: 'flex-start', maxWidth: '80%' }}>
          <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#000000', lineHeight: 1.2 }} />
        </View>
      );
    case 'flashcard': {
      const frontContent = block.front || content || 'Flashcard';
      const backContent = block.back || '';
      const isCardRtl = isArabic(prepareInteractiveSyntax(frontContent + backContent));
      return (
        <View wrap={false} style={{ marginVertical: 20 }}>
          <MinecraftBox style={{ backgroundColor: '#D9D9D9' }}>
            <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
              <Text style={{ fontSize: 8, color: '#555555', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>FRONT</Text>
              <MinecraftRichText text={frontContent} baseStyle={{ fontSize: 10, fontFamily: 'Press Start 2P', color: '#000000', textAlign: 'center', lineHeight: 1.5 }} />
            </View>
            {backContent ? (
              <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', borderTopWidth: 2, borderColor: '#555555' }}>
                 <Text style={{ fontSize: 8, color: '#555555', fontFamily: 'Press Start 2P', marginBottom: 12, textTransform: 'uppercase' }}>BACK</Text>
                <MinecraftRichText text={backContent} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: '#000000', textAlign: isCardRtl ? 'right' : 'center', lineHeight: 1.2 }} />
              </View>
            ) : []}
          </MinecraftBox>
        </View>
      );
    }
    case 'caption':
      return (
        <View wrap={false} style={{ marginTop: 4, marginBottom: 12, alignItems: 'center' }}>
          <MinecraftRichText text={content} baseStyle={{ fontSize: 12, fontFamily: 'VT323', color: '#555555', textAlign: 'center' }} />
        </View>
      );
    case 'horizontal_rule':
      return <View style={{ height: 4, backgroundColor: '#555555', marginVertical: 24 }} />;
    case 'page_break':
      return <View break />;
    case 'essay_area':
      return (
        <View wrap={false} style={{ marginVertical: 20 }}>
          <Text style={{ fontSize: 10, color: '#000000', fontFamily: 'Press Start 2P', marginBottom: 8, textTransform: 'uppercase' }}>{content || "NOTES"}</Text>
          <MinecraftInsetBox style={{ height: 200, backgroundColor: '#FFFFFF' }}>
             <View />
          </MinecraftInsetBox>
        </View>
      );
    case 'bento':
    case 'expandable':
    case 'reveal':
    case 'container':
      return (
        <View wrap={false} style={{ marginVertical: 20 }}>
          <MinecraftInsetBox style={{ padding: 16 }}>
            {block.blocks?.map((child, idx) => (
              <View key={idx} style={{ marginBottom: idx === block.blocks!.length - 1 ? 0 : 12 }}>
                 <GameMinecraftBlockRenderer block={child} docColors={docColors} isExam={isExam} />
              </View>
            ))}
          </MinecraftInsetBox>
        </View>
      );
    case 'table':
      return (
        <View wrap={false} style={{ marginVertical: 20 }}>
          <MinecraftBox>
            {block.columns && block.columns.length > 0 ? (
              <View style={{ flexDirection: 'row', backgroundColor: '#8B8B8B', padding: 8, borderBottomWidth: 2, borderColor: '#555555' }}>
                {block.columns.map((col, cIdx) => (
                  <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4 }}>
                    <MinecraftRichText text={col.toUpperCase()} baseStyle={{ fontSize: 8, color: '#FFFFFF', fontFamily: 'Press Start 2P' }} />
                  </View>
                ))}
              </View>
            ) : []}
            <View style={{ flexDirection: 'column' }}>
              {(block.rows || []).map((row, rIdx) => (
                <View key={rIdx} style={{ flexDirection: 'row', backgroundColor: '#C6C6C6', padding: 8, borderBottomWidth: rIdx === block.rows!.length - 1 ? 0 : 2, borderColor: '#8B8B8B' }}>
                  {row.map((cell, cIdx) => (
                    <View key={cIdx} style={{ flex: 1, paddingHorizontal: 4 }}>
                      <MinecraftRichText text={cell} baseStyle={{ fontSize: 15, color: '#000000', fontFamily: 'VT323', lineHeight: 1.2 }} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </MinecraftBox>
        </View>
      );
    case 'image':
      return (
        <View wrap={false} style={{ marginVertical: 20, alignItems: 'center' }}>
          <MinecraftInsetBox style={{ backgroundColor: '#000000' }}>
            <Image src={block.imageUrl || ''} style={{ width: 480, height: 'auto', objectFit: 'cover' }} />
          </MinecraftInsetBox>
          {block.imageCaption ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: '#555555', fontFamily: 'VT323' }}>{block.imageCaption}</Text>
            </View>
          ) : <View />}
        </View>
      );
    default:
      return (
        <View style={{ marginBottom: 8 }}>
          <MinecraftRichText text={content} baseStyle={{ fontSize: 15, fontFamily: 'VT323', color: MC_COLORS.text }} />
        </View>
      );
  }
};

const MinecraftTableOfContents = ({ documents }: { documents: PdfDocument[] }) => {
  const tocItems: { title: string; page: number }[] = [];
  let currentPage = 2; // Cover is 1, TOC is 2

  documents.forEach((doc, idx) => {
    tocItems.push({ title: doc.title || `Document ${idx + 1}`, page: currentPage });
    const blocksCount = doc.blocks.length;
    currentPage += Math.ceil(blocksCount / 5) || 1; 
  });

  return (
    <Page size="A4" style={{ padding: 40 }}>
      <MinecraftBackground overlay={true} />
      
      {/* Container simulating a UI screen */}
      <MinecraftBox style={{ flex: 1, padding: 24, backgroundColor: '#C6C6C6' }}>
        <View style={{ marginBottom: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontFamily: 'Press Start 2P', color: '#404040', textTransform: 'uppercase' }}>Inventory</Text>
        </View>
        <MinecraftInsetBox style={{ flex: 1, padding: 16 }}>
          {tocItems.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, color: '#FFFFFF', fontFamily: 'VT323' }}>{prepareInteractiveSyntax(item.title)}</Text>
              <Text style={{ fontSize: 18, color: '#FFFF55', fontFamily: 'VT323' }}>{String(i + (tocItems.length > 0 ? 3 : 2)).padStart(2, '0')}</Text>
            </View>
          ))}
        </MinecraftInsetBox>
      </MinecraftBox>
    </Page>
  );
};

export const ReactPdfOutputGameMinecraft = ({ 
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
  return (
    <Document title="Document Export" author="System">
      {includeCover ? (
        <Page size="A4" style={{ position: 'relative' }}>
          <MinecraftBackground overlay={false} />
          
          <View style={{ flex: 1, padding: 40, justifyContent: 'center' }}>
            <MinecraftBox style={{ padding: 40, backgroundColor: 'rgba(198, 198, 198, 0.95)' }}>
              <Text style={{ fontSize: 10, color: '#00AA00', fontFamily: 'Press Start 2P', textTransform: 'uppercase', marginBottom: 20 }}>
                {isExam ? 'ACHIEVEMENT LIST' : 'WORLD DATA'}
              </Text>
              {/* Title shadow trick */}
              <View style={{ position: 'relative', marginBottom: 30 }}>
                <Text style={{ fontSize: 28, color: '#000000', fontFamily: 'Press Start 2P', lineHeight: 1.2, top: 4, left: 4, position: 'absolute', textTransform: 'uppercase' }}>
                  {documents.length > 0 ? documents[0].title : 'UNTITLED'}
                </Text>
                <Text style={{ fontSize: 28, color: '#FFFF55', fontFamily: 'Press Start 2P', lineHeight: 1.2, textTransform: 'uppercase' }}>
                  {documents.length > 0 ? documents[0].title : 'UNTITLED'}
                </Text>
              </View>
              
              {(documents[0] as any)?.metadata?.description ? (
                <MinecraftInsetBox style={{ padding: 16 }}>
                  <Text style={{ fontSize: 16, color: '#FFFFFF', fontFamily: 'VT323', lineHeight: 1.2 }}>
                    {(documents[0] as any).metadata.description}
                  </Text>
                </MinecraftInsetBox>
              ) : <View />}
            </MinecraftBox>
          </View>
        </Page>
      ) : <View />}

      {includeToc && documents.length > 1 ? <MinecraftTableOfContents documents={documents} /> : <View />}

      {documents.map((doc, dIdx) => {
        const bgIndex = Math.floor(dIdx / 2) % 5;
        let BackgroundComponent = MinecraftBackground;
        if (bgIndex === 1) BackgroundComponent = MinesBackground;
        else if (bgIndex === 2) BackgroundComponent = NetherBackground;
        else if (bgIndex === 3) BackgroundComponent = EndBackground;
        else if (bgIndex === 4) BackgroundComponent = OceanBackground;

        return (
        <Page key={dIdx} size="A4" style={{ padding: 40, position: 'relative' }}>
          <BackgroundComponent overlay={true} />
          
          <MinecraftBox style={{ flex: 1, padding: 30, backgroundColor: '#C6C6C6' }}>
            <View style={{ marginBottom: 30, borderBottomWidth: 4, borderBottomColor: '#555555', paddingBottom: 16 }}>
              <Text style={{ fontSize: 10, color: '#555555', fontFamily: 'Press Start 2P', textTransform: 'uppercase', marginBottom: 8 }}>
                CHAPTER {String((dIdx + 1)).padStart(2, '0')}
              </Text>
              {/* Title shadow trick */}
              <View style={{ position: 'relative' }}>
                <Text style={{ fontSize: 18, color: '#555555', fontFamily: 'Press Start 2P', top: 2, left: 2, position: 'absolute', textTransform: 'uppercase' }}>
                  {doc.title}
                </Text>
                <Text style={{ fontSize: 18, color: '#404040', fontFamily: 'Press Start 2P', textTransform: 'uppercase' }}>
                  {doc.title}
                </Text>
              </View>
            </View>

            {doc.blocks.map((block, bIdx) => (
              <GameMinecraftBlockRenderer key={bIdx} block={block} docColors={{}} isExam={isExam} />
            ))}
          </MinecraftBox>

          {/* Footer */}
          <View fixed style={{ position: 'absolute', bottom: 55, left: 70, right: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
             <Text style={{ fontSize: 12, color: '#404040', fontFamily: 'VT323', textTransform: 'uppercase' }}>{doc.title}</Text>
             <Text style={{ fontSize: 10, color: '#404040', fontFamily: 'Press Start 2P' }} render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
          </View>
        </Page>
        );
      })}
    </Document>
  );
};

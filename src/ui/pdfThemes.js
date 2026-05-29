export const pdfThemes = {
    "الوضع الافتراضي": `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=Cairo:wght@400;700;900&display=swap');
        
        body { 
            background-color: #ffffff !important; 
            color: #1f2937 !important; 
            font-family: 'Plus Jakarta Sans', 'Cairo', sans-serif !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background: #ffffff !important; 
            color: #1f2937 !important;
            padding: 20px !important;
            border: none !important;
        }
        .print-question { 
            background: #ffffff !important; 
            color: #1f2937 !important;
            border: 1px solid #e5e7eb !important; 
            border-radius: 12px !important; 
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #4f46e5 !important; 
            color: #ffffff !important;
            padding: 4px 10px !important;
            border-radius: 6px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
            font-weight: bold !important;
            border: none !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #f9fafb !important; 
            border: 1px solid #e5e7eb !important;
            color: #1f2937 !important;
            padding: 12px !important;
            border-radius: 6px !important;
        }
        .match-pill, table, th, td { 
            background: #f3f4f6 !important; 
            border: 1px solid #e5e7eb !important;
            color: #1f2937 !important;
        }
    `,
    "طابع تقني": `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=Cairo:wght@400;700;900&display=swap');
        
        body { 
            background-color: #f3f4f6 !important; 
            color: #1f2937 !important; 
            font-family: 'Plus Jakarta Sans', 'Cairo', sans-serif !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background: #ffffff !important; 
            color: #1f2937 !important;
            border-radius: 24px !important; 
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05) !important;
            padding: 40px !important;
            border: 1px solid #e5e7eb !important;
        }
        .print-question { 
            background: #ffffff !important; 
            color: #1f2937 !important;
            border: 1px solid #e5e7eb !important; 
            border-radius: 16px !important; 
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05) !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%) !important; 
            color: #ffffff !important;
            padding: 4px 10px !important;
            border-radius: 8px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
            font-weight: bold !important;
            border: none !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #f8fafc !important; 
            border: 1px solid #e2e8f0 !important;
            color: #1f2937 !important;
            padding: 12px !important;
            border-radius: 8px !important;
        }
        .match-pill, table, th, td { 
            background: #f1f5f9 !important; 
            border: 1px solid #e2e8f0 !important;
            color: #1f2937 !important;
        }
    `,
    "ماين كرافت": `
        @import url('https://fonts.googleapis.com/css2?family=VT323&family=Cairo:wght@400;700;900&display=swap');
        
        body { 
            background-color: #4c321c !important; 
            color: #ffffff !important; 
            font-family: 'VT323', 'Cairo', monospace !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background-color: #2e2214 !important; 
            color: #ffffff !important;
            border: 8px solid #1a120a !important;
            padding: 40px !important;
        }
        .print-question { 
            background: #443322 !important; 
            color: #ffffff !important;
            border: 4px solid #8e6c49 !important; 
            box-shadow: 4px 4px 0px #1a120a !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #5c8e32 !important; 
            border: 2px solid #3c5e20 !important; 
            color: #ffffff !important;
            padding: 4px 10px !important;
            border-radius: 4px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #1e150c !important; 
            border: none !important;
            border-left: 6px solid #5c8e32 !important;
            border-right: 6px solid #5c8e32 !important;
            color: #ffffff !important;
            padding: 12px !important;
        }
        .match-pill, table, th, td { 
            background: #3a2210 !important; 
            border: 2px solid #8e6c49 !important;
            color: #ffffff !important;
        }
    `,
    "هكر ترمنال": `
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap');
        
        body { 
            background-color: #000000 !important; 
            color: #00ff00 !important; 
            font-family: 'Courier Prime', monospace !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background-color: #050505 !important; 
            color: #00ff00 !important;
            border: 2px solid #00ff00 !important;
            padding: 40px !important;
        }
        .print-question { 
            background: #020c02 !important; 
            color: #00ff00 !important;
            border: 1px solid #00ff00 !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #00ff00 !important; 
            color: #000000 !important; 
            font-weight: bold !important;
            padding: 4px 10px !important;
            border-radius: 4px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
            border: none !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #001100 !important; 
            border: 1px dashed #00ff00 !important;
            color: #00ff00 !important;
            padding: 12px !important;
        }
        .match-pill, table, th, td { 
            background: #050505 !important; 
            border: 1px solid #00ff00 !important;
            color: #00ff00 !important;
        }
    `,
    "ليلى فخم": `
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        
        body { 
            background-color: #0f172a !important; 
            color: #f1f5f9 !important; 
            font-family: 'Cairo', sans-serif !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background-color: #1e293b !important; 
            color: #f1f5f9 !important;
            border: 1px solid #334155 !important;
            padding: 40px !important;
        }
        .print-question { 
            background: #0f172a !important; 
            color: #f1f5f9 !important;
            border: 1px solid #38bdf8 !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #0284c7 !important; 
            color: #ffffff !important;
            padding: 4px 10px !important;
            border-radius: 6px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
            border: none !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #1e293b !important; 
            border: none !important;
            border-right: 4px solid #38bdf8 !important;
            border-left: 4px solid #38bdf8 !important;
            color: #f1f5f9 !important;
            padding: 12px !important;
        }
        .match-pill, table, th, td { 
            background: #1e293b !important; 
            border: 1px solid #334155 !important;
            color: #f1f5f9 !important;
        }
    `,
    "ريترو": `
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime&family=Cairo:wght@400;700;900&display=swap');
        
        body { 
            background-color: #e6dfd3 !important; 
            color: #2c251d !important; 
            font-family: 'Courier Prime', 'Cairo', serif !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background-color: #f6ebd9 !important; 
            color: #2c251d !important;
            border: 3px double #5a4a35 !important;
            padding: 40px !important;
        }
        .print-question { 
            background: #faf2e6 !important; 
            color: #2c251d !important;
            border: 1px solid #8c765c !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #5a4a35 !important; 
            color: #f6ebd9 !important;
            padding: 4px 10px !important;
            border-radius: 4px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
            border: none !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: rgba(90, 74, 53, 0.05) !important; 
            border: 1px solid #5a4a35 !important; 
            border-style: dotted !important;
            color: #2c251d !important;
            padding: 12px !important;
        }
        .match-pill, table, th, td { 
            background: #f6ebd9 !important; 
            border: 1px solid #8c765c !important;
            color: #2c251d !important;
        }
    `,
    "مانجا": `
        @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Cairo:wght@400;700;900&display=swap');
        
        body { 
            background-color: #f9f9f9 !important; 
            color: #000000 !important; 
            font-family: 'Comic Neue', 'Cairo', sans-serif !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background-color: #ffffff !important; 
            color: #000000 !important;
            border: 4px solid #000000 !important; 
            box-shadow: 8px 8px 0px #000000 !important;
            padding: 40px !important;
        }
        .print-question { 
            background: #ffffff !important; 
            color: #000000 !important;
            border: 3px solid #000000 !important; 
            box-shadow: 5px 5px 0px #000000 !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #fde047 !important; 
            color: #000000 !important; 
            border: 2px solid #000000 !important; 
            font-weight: 900 !important;
            padding: 4px 10px !important;
            border-radius: 4px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #f3f4f6 !important; 
            border: 2px solid #000000 !important;
            color: #000000 !important;
            padding: 12px !important;
        }
        .match-pill, table, th, td { 
            background: #ffffff !important; 
            border: 2px solid #000000 !important;
            color: #000000 !important;
        }
    `,
    "سايبربانك": `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Cairo:wght@400;700;900&display=swap');
        
        body { 
            background-color: #120136 !important; 
            color: #00f0ff !important; 
            font-family: 'Orbitron', 'Cairo', sans-serif !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background-color: #03001e !important; 
            color: #00f0ff !important;
            border: 3px solid #ff007f !important; 
            box-shadow: 0 0 15px #ff007f !important;
            padding: 40px !important;
        }
        .print-question { 
            background: #120136 !important; 
            color: #00f0ff !important;
            border: 2px solid #00f0ff !important; 
            box-shadow: 3px 3px 0px #ff007f !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #ff007f !important; 
            color: #ffffff !important;
            padding: 4px 10px !important;
            border-radius: 4px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
            border: none !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #0b0026 !important; 
            border: 1px solid #ff007f !important;
            color: #00f0ff !important;
            padding: 12px !important;
        }
        .match-pill, table, th, td { 
            background: rgba(255, 0, 127, 0.1) !important; 
            border: 1px solid #ff007f !important;
            color: #00f0ff !important;
        }
    `,
    "باستيل": `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600&family=Tajawal:wght@400;700&display=swap');
        
        body { 
            background-color: #f3f0ff !important; 
            color: #4a3e3d !important; 
            font-family: 'Plus Jakarta Sans', 'Tajawal', sans-serif !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background-color: #ffffff !important; 
            color: #4a3e3d !important;
            border: 4px solid #e8e2f2 !important; 
            border-radius: 30px !important;
            padding: 40px !important;
        }
        .print-question { 
            background: #faf5ff !important; 
            color: #4a3e3d !important;
            border: 2px solid #e9d5ff !important; 
            border-radius: 20px !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #d8b4fe !important; 
            color: #4c1d95 !important;
            padding: 4px 10px !important;
            border-radius: 10px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
            border: none !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #f3e8ff !important;
            color: #4a3e3d !important;
            padding: 12px !important;
            border-radius: 8px !important;
        }
        .match-pill, table, th, td { 
            background: #faf5ff !important; 
            border: 1px solid #e9d5ff !important;
            color: #4a3e3d !important;
        }
    `,
    "غابات": `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
        
        body { 
            background-color: #e2e8f0 !important; 
            color: #1e293b !important; 
            font-family: 'Tajawal', sans-serif !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background-color: #f7fee7 !important; 
            color: #1e293b !important;
            border: 2px solid #a3e635 !important;
            padding: 40px !important;
        }
        .print-question { 
            background: #ffffff !important; 
            color: #1e293b !important;
            border: 1px solid #bef264 !important; 
            border-top: 6px solid #65a30d !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #4d7c0f !important; 
            color: #ffffff !important;
            padding: 4px 10px !important;
            border-radius: 4px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
            border: none !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #f4fdf0 !important; 
            border: 1px solid #d9f99d !important;
            color: #1e293b !important;
            padding: 12px !important;
            border-radius: 8px !important;
        }
        .match-pill, table, th, td { 
            background: #f4fdf0 !important; 
            border: 1px solid #bef264 !important;
            color: #1e293b !important;
        }
    `,
    "الجامعة الملكية": `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Cairo:wght@400;700&display=swap');
        
        body { 
            background-color: #f1f5f9 !important; 
            color: #0f172a !important; 
            font-family: 'Playfair Display', 'Cairo', serif !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .print-container { 
            background-color: #ffffff !important; 
            color: #0f172a !important;
            border: 2px solid #1e3a8a !important;
            padding: 40px !important;
        }
        .print-question { 
            background: #fffdfa !important; 
            color: #0f172a !important;
            border: none !important;
            border-bottom: 3px double #1e3a8a !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
        }
        .accent-badge { 
            background: #1e3a8a !important; 
            color: #ffffff !important;
            padding: 4px 10px !important;
            border-radius: 4px !important;
            display: inline-block !important;
            font-size: 0.8rem !important;
            border: none !important;
        }
        .answer-box, .print-question li[style*="color:#2a9d8f"], .print-question li[style*="color: rgb(42, 157, 143)"] { 
            background: #f8fafc !important; 
            border: none !important;
            border-right: 4px solid #b45309 !important;
            border-left: 4px solid #b45309 !important;
            color: #0f172a !important;
            padding: 12px !important;
        }
        .match-pill, table, th, td { 
            background: #fffdfa !important; 
            border: 1px solid #1e3a8a !important;
            color: #0f172a !important;
        }
    `
};

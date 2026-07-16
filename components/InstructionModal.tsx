
import React, { useState } from 'react';

interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

const CATEGORIES = [
  {
    title: "🎯 Nhóm Sao Chép 1:1 (Clone)",
    prompts: [
      { label: "Clone Chính Xác Từng Pixel", text: "CHẾ ĐỘ SAO CHÉP KỸ THUẬT SỐ: Tạo bản sao chính xác 100% về bố cục, font chữ và màu sắc. Làm phẳng thiết kế (Flat Design) và xóa bỏ nếp nhăn vải." },
      { label: "Tái Tạo Vector Sắc Nét", text: "Vẽ lại thiết kế này thành bản Vector 2D hoàn hảo. Làm sắc nét các cạnh, khử nhiễu và chuẩn hóa màu sắc để in ấn (Clean Trace)." }
    ]
  },
  {
    title: "✍️ Nhóm Thay Đổi Chữ (Text)",
    prompts: [
      { label: "Đổi Nội Dung Giữ Style", text: "Giữ nguyên hoàn toàn phong cách, hiệu ứng và font chữ cũ, nhưng thay đổi nội dung chữ [Nội dung cũ] thành [Nội dung mới]." },
      { label: "Thay Font Chữ Mới", text: "Thay đổi dòng chữ [Text] thành [Nội dung mới] và sử dụng font chữ phong cách Script (Viết tay) mềm mại hơn." }
    ]
  },
  {
    title: "🎨 Nhóm Sáng Tạo (Style)",
    prompts: [
      { label: "Tone Màu Vintage 90s", text: "Giữ nguyên thiết kế nhưng chuyển toàn bộ tông màu sang phong cách Vintage Pastel cổ điển thập niên 90." },
      { label: "Phong Cách Neon Cyberpunk", text: "Thay thế các chi tiết màu nóng thành màu Neon phát sáng rực rỡ trên nền tối." },
      { label: "Đen Trắng Tương Phản", text: "Chuyển thiết kế sang chế độ Đen Trắng (Black & White) với độ tương phản cao để in lụa." }
    ]
  }
];

const InstructionModal: React.FC<InstructionModalProps> = ({ isOpen, onClose, onSelectPrompt }) => {
  const [activeTab, setActiveTab] = useState<'prompts' | 'setup' | 'pricing'>('prompts');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10 rounded-t-[2.5rem]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-black gradient-text uppercase tracking-tight">Trung Tâm Hỗ Trợ</h2>
              <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest">Tối ưu hóa thiết kế & Cấu hình API</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex gap-2 p-1 bg-slate-950 rounded-2xl w-fit">
            <button 
              onClick={() => setActiveTab('prompts')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'prompts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Mẫu Câu Lệnh (Prompts)
            </button>
            <button 
              onClick={() => setActiveTab('pricing')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pricing' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Chi phí & Gói Model
            </button>
            <button 
              onClick={() => setActiveTab('setup')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'setup' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Cách tạo API Key
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto">
          {activeTab === 'prompts' ? (
            <div className="space-y-10">
              <section>
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">💡 Mẹo có kết quả tốt nhất</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                    <span className="text-indigo-400 font-bold block mb-1">Cấu trúc lệnh:</span>
                    <p className="text-[11px] text-slate-400">[Giữ lại cái gì] + [Thay đổi cái gì] + [Phong cách mong muốn]</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                    <span className="text-emerald-400 font-bold block mb-1">Tự động chọn nền:</span>
                    <p className="text-[11px] text-slate-400">AI sẽ tự chọn màu nền (Xanh/Hồng/Đen) tương phản nhất để dễ tách nền sau này.</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                    <span className="text-amber-400 font-bold block mb-1">Độ phân giải:</span>
                    <p className="text-[11px] text-slate-400">Mặc định xuất file chuẩn MBA 4500x5400px (300DPI) khi dùng Model Pro.</p>
                  </div>
                </div>
              </section>

              {CATEGORIES.map((cat, i) => (
                <section key={i} className="space-y-4">
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-3">
                    <span className="w-8 h-px bg-slate-800"></span>
                    {cat.title}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {cat.prompts.map((p, j) => (
                      <div 
                        key={j} 
                        className="group bg-slate-950/40 border border-slate-800 hover:border-indigo-500/50 p-5 rounded-[1.5rem] transition-all"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">{p.label}</h4>
                          <button 
                            onClick={() => {
                              onSelectPrompt(p.text);
                              onClose();
                            }}
                            className="text-[9px] font-black bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-full transition-all uppercase"
                          >
                            Áp dụng
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed italic">"{p.text}"</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : activeTab === 'pricing' ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-3xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <h4 className="text-sm font-black uppercase text-amber-500">Gói Cơ Bản (Draft)</h4>
                  </div>
                  <ul className="space-y-3 text-[11px] text-slate-400">
                    <li className="flex gap-2">
                      <span className="text-amber-500">●</span>
                      <span><strong>Model:</strong> Gemini 2.5 Flash Image.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-amber-500">●</span>
                      <span><strong>Chi phí:</strong> Có thể <strong>MIỄN PHÍ</strong> nếu dùng API Key Free của Google AI Studio.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-amber-500">●</span>
                      <span><strong>Đặc điểm:</strong> Tốc độ cực nhanh, phù hợp để thử nghiệm ý tưởng hoặc phác thảo.</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-indigo-500/5 border border-indigo-500/20 p-6 rounded-3xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-500">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>
                    </div>
                    <h4 className="text-sm font-black uppercase text-indigo-500">Gói Sản Xuất (Production)</h4>
                  </div>
                  <ul className="space-y-3 text-[11px] text-slate-400">
                    <li className="flex gap-2">
                      <span className="text-indigo-500">●</span>
                      <span><strong>Model:</strong> Gemini 3 Pro Image Preview.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-500">●</span>
                      <span><strong>Chi phí:</strong> Tính phí theo <strong>BẬC 4K</strong> (Phí Premium).</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-500">●</span>
                      <span><strong>Đặc điểm:</strong> Vẽ trực tiếp kích thước 4500x5400px gốc. Cực kỳ sắc nét, giữ nguyên chi tiết nhỏ nhất.</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl">
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                  * Tool tự động tối ưu hóa mọi thiết kế lên chuẩn 4500x5400px. Với Model Pro, chất lượng sẽ là tốt nhất thị trường hiện nay.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <section className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl">
                <h3 className="text-indigo-400 text-sm font-black uppercase tracking-tight flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 17c-.77 1.333.192 3 1.732 3z" /></svg>
                  Yêu cầu bắt buộc cho Gemini 3 Pro
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Để tạo ảnh 4K sắc nét nhất, tool sử dụng model mạnh nhất của Google. Model này <strong>bắt buộc</strong> phải dùng API Key từ một <strong>Google Cloud Project đã bật thanh toán (Billing)</strong>. Tài khoản Free Tier sẽ không chạy được model này.
                </p>
              </section>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 text-xs font-black">1</div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-200 mb-1">Thiết lập Thanh toán (Billing)</h4>
                    <p className="text-[11px] text-slate-400">Truy cập <a href="https://console.cloud.google.com/billing" target="_blank" className="text-indigo-400 underline">Google Cloud Billing</a>, tạo tài khoản thanh toán và thêm thẻ Visa/Mastercard.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 text-xs font-black">2</div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-200 mb-1">Tạo API Key trong Project đó</h4>
                    <p className="text-[11px] text-slate-400">Vào <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-400 underline">AI Studio</a>, chọn <strong>"Create API key in existing project"</strong> và chọn Project bạn vừa thêm thẻ.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 text-xs font-black">3</div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-200 mb-1">Nhập Key vào Tool</h4>
                    <p className="text-[11px] text-slate-400">Nhấn nút <strong>"Đổi API Key"</strong> ở góc trên bên phải trang chủ của Tool này và chọn đúng Project đó.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/80 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Phát triển bởi Senior Frontend Engineer • 2024
          </p>
        </div>
      </div>
    </div>
  );
};

export default InstructionModal;

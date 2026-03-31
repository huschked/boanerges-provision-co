import React, { useState } from 'react';
import { Mail, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { db, doc, updateDoc } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied';
  createdAt: any;
}

interface MessagesViewProps {
  messages: ContactMessage[];
  onRefresh: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ messages, onRefresh }) => {
  const [selectedMsg, setSelectedMsg] = useState<ContactMessage | null>(null);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'contact_messages', id), { status });
      onRefresh();
    } catch (error) {
      console.error("Error updating message:", error);
    }
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Message List */}
        <div className="lg:col-span-4 card-premium overflow-hidden flex flex-col h-[700px]">
          <div className="p-8 border-b border-white/5 bg-white/[0.01] flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="text-2xl font-serif text-brand-parchment">Inquiries</h3>
              <p className="text-[9px] uppercase tracking-[0.2em] text-brand-gold/40 font-black">Customer communications</p>
            </div>
            <div className="px-3 py-1 bg-brand-gold/10 rounded-full border border-brand-gold/20">
              <span className="text-[9px] text-brand-gold font-black uppercase tracking-widest">{messages.filter(m => m.status === 'new').length} New</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {messages.map((msg) => (
              <button 
                key={msg.id}
                onClick={() => { setSelectedMsg(msg); if(msg.status === 'new') updateStatus(msg.id, 'read'); }}
                className={cn(
                  "w-full p-8 text-left transition-all duration-500 group relative",
                  selectedMsg?.id === msg.id ? "bg-brand-gold/[0.03]" : "hover:bg-white/[0.02]"
                )}
              >
                {selectedMsg?.id === msg.id && (
                  <motion.div 
                    layoutId="activeMessage"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-brand-gold shadow-[0_0_15px_rgba(212,175,55,0.5)]"
                  />
                )}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      msg.status === 'new' ? "bg-brand-gold animate-pulse shadow-[0_0_8px_rgba(212,175,55,0.5)]" : "bg-white/10"
                    )} />
                    <p className={cn(
                      "text-sm font-black transition-colors duration-500",
                      msg.status === 'new' ? "text-brand-parchment" : "text-brand-parchment/40 group-hover:text-brand-parchment/60"
                    )}>
                      {msg.name}
                    </p>
                  </div>
                  <span className="text-[8px] text-brand-parchment/30 uppercase tracking-widest font-black">
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
                <p className="text-[10px] text-brand-gold/60 font-black uppercase tracking-[0.15em] mb-2 truncate">{msg.subject}</p>
                <p className="text-[11px] text-brand-parchment/30 line-clamp-2 font-light italic leading-relaxed">{msg.message}</p>
              </button>
            ))}
            {messages.length === 0 && (
              <div className="p-20 text-center space-y-4">
                <Mail size={32} className="mx-auto text-brand-parchment/10" />
                <p className="text-[10px] uppercase tracking-widest text-brand-parchment/20 font-black">No messages found</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-8 h-[700px]">
          {selectedMsg ? (
            <motion.div 
              key={selectedMsg.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card-premium h-full flex flex-col overflow-hidden"
            >
              <div className="p-10 border-b border-white/5 bg-white/[0.01] flex justify-between items-start">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-brand-gold/5 border border-brand-gold/10 flex items-center justify-center text-brand-gold text-lg font-black shadow-inner">
                      {selectedMsg.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-3xl font-serif text-brand-parchment leading-tight">{selectedMsg.subject}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[11px] text-brand-parchment font-black">{selectedMsg.name}</p>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <p className="text-[10px] text-brand-parchment/40 font-medium">{selectedMsg.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="p-4 rounded-full bg-white/5 text-brand-parchment/30 hover:text-brand-gold hover:bg-brand-gold/10 transition-all duration-500 border border-white/5">
                    <Mail size={18} />
                  </button>
                  <button className="p-4 rounded-full bg-white/5 text-brand-parchment/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-500 border border-white/5">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-12 overflow-y-auto bg-brand-charcoal/20">
                <div className="max-w-3xl mx-auto space-y-10">
                  <div className="flex justify-center">
                    <div className="px-6 py-2 bg-white/[0.02] border border-white/5 rounded-full text-[9px] uppercase tracking-[0.3em] text-brand-parchment/20 font-black">
                      Received {selectedMsg.createdAt?.toDate ? selectedMsg.createdAt.toDate().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                  <div className="p-10 bg-white/[0.01] rounded-sm border border-white/5 shadow-2xl relative">
                    <div className="absolute top-0 left-10 w-px h-10 bg-gradient-to-b from-brand-gold/40 to-transparent" />
                    <p className="text-brand-parchment/80 text-lg leading-[1.8] font-light italic whitespace-pre-wrap">
                      "{selectedMsg.message}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-10 bg-white/[0.01] border-t border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-6">
                  <label className="text-[9px] uppercase tracking-[0.2em] text-brand-parchment/30 font-black">Status</label>
                  <select 
                    value={selectedMsg.status}
                    onChange={(e) => updateStatus(selectedMsg.id, e.target.value)}
                    className="input-premium py-2 px-6 text-[10px] uppercase tracking-[0.2em] font-black cursor-pointer w-auto min-w-[160px]"
                  >
                    <option value="new">New Inquiry</option>
                    <option value="read">Mark as Read</option>
                    <option value="replied">Replied</option>
                  </select>
                </div>
                <button className="btn-primary flex items-center gap-3 px-10">
                  <Mail size={16} strokeWidth={3} />
                  Draft Response
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center card-premium p-20 text-center space-y-8 bg-brand-charcoal/20">
              <div className="w-24 h-24 bg-brand-gold/5 rounded-full flex items-center justify-center border border-brand-gold/10 shadow-inner">
                <Mail size={40} className="text-brand-gold/20" />
              </div>
              <div className="space-y-3 max-w-xs">
                <h3 className="text-3xl font-serif text-brand-parchment">Select an Inquiry</h3>
                <p className="text-brand-parchment/30 text-sm font-light italic leading-relaxed">Choose a customer message from the inbox to view details and draft a response.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

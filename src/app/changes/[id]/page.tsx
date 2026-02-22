'use client';
import { useState, useEffect, use, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function EditChange({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise); 
  const id = params.id;
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    change_id: '',
    applicativo: '',
    breve_descrizione: '',
    stato: '',
    rilascio_in_collaudo: '',
    rilascio_in_produzione: '',
    ticket_analisi: false,
    ticket_test: false,
    ticket_rilascio: false,
    note_sviluppatori: ''
  });

  useEffect(() => {
    async function loadChange() {
      const { data, error } = await supabase
        .from('changes')
        .select('*')
        .eq('id', id)
        .single();

      if (data) setFormData(data);
      setLoading(false);
    }
    loadChange();
  }, [id, supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Generazione stringa Ticket automatica dai flag
    const ticketLabels = [];
    if (formData.ticket_analisi) ticketLabels.push("Ticket Analisi");
    if (formData.ticket_test) ticketLabels.push("Ticket Test");
    if (formData.ticket_rilascio) ticketLabels.push("Ticket Rilascio");
    const stringaTicket = ticketLabels.join(", ");

    const { error } = await supabase
      .from('changes')
      .update({
        ...formData,
        ticket: stringaTicket
      })
      .eq('id', id);

    if (error) {
      alert("Errore: " + error.message);
    } else {
      router.refresh();
      router.back();
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Caricamento...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white shadow-2xl rounded-3xl my-10 border border-slate-100">
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Modifica Change</h1>
        <span className="text-sm font-mono text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-bold">
          ID: {formData.change_id}
        </span>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Applicativo</label>
          <input 
            type="text"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            value={formData.applicativo || ''}
            onChange={(e) => setFormData({...formData, applicativo: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Stato</label>
          <select 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            value={formData.stato || ''}
            onChange={(e) => setFormData({...formData, stato: e.target.value})}
          >
            <option value="In Attesa">In Attesa</option>
            <option value="In Collaudo">In Collaudo</option>
            <option value="In Produzione">In Produzione</option>
            <option value="Annullata">Annullata</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Breve Descrizione</label>
          <input 
            type="text"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            value={formData.breve_descrizione || ''}
            onChange={(e) => setFormData({...formData, breve_descrizione: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Collaudo</label>
          <input 
            type="date"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            value={formData.rilascio_in_collaudo || ''}
            onChange={(e) => setFormData({...formData, rilascio_in_collaudo: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Produzione</label>
          <input 
            type="date"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            value={formData.rilascio_in_produzione || ''}
            onChange={(e) => setFormData({...formData, rilascio_in_produzione: e.target.value})}
          />
        </div>

        {/* Checkbox Flag Ridotti */}
        <div className="md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest text-center">Checklist Documentale</label>
          <div className="flex justify-center gap-6">
            
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 accent-green-600 cursor-pointer"
                checked={formData.ticket_analisi}
                onChange={(e) => setFormData({...formData, ticket_analisi: e.target.checked})}
              />
              <span className={`text-xs font-bold transition-colors ${formData.ticket_analisi ? 'text-green-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Analisi</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 accent-blue-600 cursor-pointer"
                checked={formData.ticket_test}
                onChange={(e) => setFormData({...formData, ticket_test: e.target.checked})}
              />
              <span className={`text-xs font-bold transition-colors ${formData.ticket_test ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Test</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 accent-purple-600 cursor-pointer"
                checked={formData.ticket_rilascio}
                onChange={(e) => setFormData({...formData, ticket_rilascio: e.target.checked})}
              />
              <span className={`text-xs font-bold transition-colors ${formData.ticket_rilascio ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Rilascio</span>
            </label>

          </div>
        </div>

        <div className="md:col-span-2 flex justify-end gap-4 mt-6 border-t pt-6">
          <button type="button" onClick={() => router.back()} className="px-6 py-2 text-sm font-bold text-slate-400 hover:text-slate-600">Annulla</button>
          <button 
            type="submit" 
            disabled={saving}
            className={`px-10 py-3 rounded-xl text-white font-bold shadow-lg ${saving ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
          >
            {saving ? 'Salvataggio...' : 'Salva Modifiche'}
          </button>
        </div>
      </form>
    </div>
  );
}
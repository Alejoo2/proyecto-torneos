"use client";

import { useState } from "react";
import { Button } from "torneos/components/ui/button/button";

interface CreateTournamentInput {
  courtId: string;
  name: string;
  maxTeams: number;
  dayOfWeek: number;
  timeSlot: number;
  enrollmentDeadline: Date;
  format?: "SINGLE_ELIMINATION" | "LEAGUE" | "LEAGUE_PLUS_ELIMINATION";
  type?: "PUBLIC" | "PRIVATE";
  description?: string;
  startDate?: Date;
}

interface CreateTournamentModalProps {
  courtId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateTournamentInput) => void;
}

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SLOTS = ["00:00 - 02:00", "02:00 - 04:00", "04:00 - 06:00", "06:00 - 08:00", "08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00", "14:00 - 16:00", "16:00 - 18:00", "18:00 - 20:00", "20:00 - 22:00", "22:00 - 00:00"];

export function CreateTournamentModal({ courtId, isOpen, onClose, onCreate }: CreateTournamentModalProps) {
  const [name, setName] = useState("");
  const [maxTeams, setMaxTeams] = useState(8);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [timeSlot, setTimeSlot] = useState(9); // 18:00 por defecto
  const [deadline, setDeadline] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      courtId,
      name,
      maxTeams,
      dayOfWeek,
      timeSlot,
      enrollmentDeadline: new Date(deadline),
      format: "SINGLE_ELIMINATION",
      type: "PUBLIC"
    });
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-6"></div>
        
        <h3 className="text-lg font-bold text-zinc-900 mb-4">Crear Torneo en esta Cancha</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Nombre del Torneo</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Ej: Liga de Barrio 2026" 
              required
              className="w-full h-12 bg-zinc-50 rounded-xl border border-zinc-200 px-4 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Cupos Máximos</label>
            <select 
              value={maxTeams} 
              onChange={(e) => setMaxTeams(Number(e.target.value))}
              className="w-full h-12 bg-zinc-50 rounded-xl border border-zinc-200 px-4 focus:border-zinc-400 focus:outline-none"
            >
              <option value={4}>4 equipos</option>
              <option value={8}>8 equipos</option>
              <option value={16}>16 equipos</option>
              <option value={32}>32 equipos</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Día del torneo</label>
              <select 
                value={dayOfWeek} 
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full h-12 bg-zinc-50 rounded-xl border border-zinc-200 px-4 focus:border-zinc-400 focus:outline-none"
              >
                {DAYS.map((day, i) => <option key={i} value={i}>{day}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Franja Horaria</label>
              <select 
                value={timeSlot} 
                onChange={(e) => setTimeSlot(Number(e.target.value))}
                className="w-full h-12 bg-zinc-50 rounded-xl border border-zinc-200 px-4 focus:border-zinc-400 focus:outline-none"
              >
                {SLOTS.map((slot, i) => <option key={i} value={i}>{slot}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Cierra Inscripción</label>
            <input 
              type="date" 
              value={deadline} 
              onChange={(e) => setDeadline(e.target.value)} 
              required
              className="w-full h-12 bg-zinc-50 rounded-xl border border-zinc-200 px-4 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" className="flex-1 min-h-[48px]" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 min-h-[48px]">
              Crear Torneo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
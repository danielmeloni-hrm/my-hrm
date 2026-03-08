// src/lib/ticket-utils.ts

export const PING_THRESHOLD_DAYS = 15;

export const isPingExpired = (dateString: string | null | undefined): boolean => {
  if (!dateString) return false;
  const lastPing = new Date(dateString);
  const today = new Date();
  const diffDays = Math.ceil(Math.abs(today.getTime() - lastPing.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > PING_THRESHOLD_DAYS;
};

export const formatDateShort = (dateString: string | null | undefined): string => {
  if (!dateString) return '--/--';
  return new Date(dateString).toLocaleDateString('it-IT', { 
    day: '2-digit', 
    month: '2-digit' 
  });
};

/**
 * Esportiamo esattamente getPingStyles
 */
export const getPingStyles = (dateString: string | null | undefined) => {
  const expired = isPingExpired(dateString);
  return {
    container: expired ? "text-red-500 font-bold" : "text-gray-400",
    icon: expired ? "text-red-500 animate-pulse" : "text-gray-200"
  };
};
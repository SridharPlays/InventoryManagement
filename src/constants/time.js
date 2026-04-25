export const YEARS = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

export const MONTHS = [
  { label: 'Jan', val: 1 }, { label: 'Feb', val: 2 }, { label: 'Mar', val: 3 },
  { label: 'Apr', val: 4 }, { label: 'May', val: 5 }, { label: 'Jun', val: 6 },
  { label: 'Jul', val: 7 }, { label: 'Aug', val: 8 }, { label: 'Sep', val: 9 },
  { label: 'Oct', val: 10 }, { label: 'Nov', val: 11 }, { label: 'Dec', val: 12 }
];

// 1. Add this helper function anywhere in your Google Apps Script
export function parseCustomDate(dateString) {
  if (!dateString) return null;
  
  // If it's already a Date object (sometimes GAS auto-parses sheets)
  if (dateString.getTime) return dateString; 

  // Split the DD/MM/YYYY string
  let parts = String(dateString).split('/');
  if (parts.length === 3) {
    // new Date(year, monthIndex, day)
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  
  // Fallback if the format is different
  return new Date(dateString); 
}
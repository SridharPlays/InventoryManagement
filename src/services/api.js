import { StorageService } from './storage';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzyURMe1zXn5zccSycaStmH4OCVb4WWTDI2kLIroL03lPDMyoQM0XvJouiJbBilqWQ7/exec';

// --- GET REQUESTS (Existing) ---
export const fetchFromGAS = async (action) => {
  try {
    const response = await fetch(`${GAS_URL}?action=${action}`);
    const data = await response.json();
    
    if (data) {
      await StorageService.cacheData(action, data);
      return data;
    }
    return null;
  } catch (error) {
    console.error(`API Error GET (${action}):`, error);
    return await StorageService.getCachedData(action);
  }
};

// --- POST REQUESTS (New) ---
export const postToGAS = async (action, payload = {}) => {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        // text/plain avoids CORS OPTIONS preflight block in GAS
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      // Merge the action into the payload body for your switch statement
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow' 
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`API Error POST (${action}):`, error);
    return { success: false, message: error.message };
  }
};
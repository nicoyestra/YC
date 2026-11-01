
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const url = config.url || '';

  // Las rutas Master deben usar el token Master.
  const esMaster =
    url.startsWith('/master/') || url === '/master';

  const token = localStorage.getItem(
    esMaster ? 'master_token' : 'erp_token'
  );

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (error.response?.status === 401) {
        localStorage.removeItem('erp_token');
        localStorage.removeItem('erp_usuario');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

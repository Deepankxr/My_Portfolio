(() => {try {const saved=localStorage.getItem('theme');if(saved==='dark'||saved==='light')document.documentElement.dataset.theme=saved;}catch (_) {}})();

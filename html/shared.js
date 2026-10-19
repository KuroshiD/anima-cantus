/* =========================================================
   Anima Cantus — JS compartilhado
   Estado local (protótipo), valores, validação de formulários,
   máscaras, logout e utilitários usados por várias telas.
   Tudo que depende da API está marcado com TODO.
   ========================================================= */
(function () {
  'use strict';

  var AC = (window.AC = {});

  /* Versão vigente dos Termos e da Política (registrada no aceite) */
  AC.LEGAL_VERSION = '2026-10-19';

  /* Serviços contratáveis. TODO: vir da API. */
  AC.SERVICES = [
    { id: 'pacote',         nome: 'Pacote completo',          desc: 'Música para toda a cerimônia.',             preco: 3500, fixo: true },
    { id: 'instrumentista', nome: 'Instrumentista adicional', desc: 'Um músico a mais na formação.',             preco: 400 },
    { id: 'recepcao',       nome: 'Recepção',                 desc: 'Música durante a recepção dos convidados.', preco: 800 }
  ];

  /* ---------- Estado local (substituir pela API) ---------- */
  AC.store = {
    get: function (k) {
      try { var v = localStorage.getItem('ac:' + k); return v === null ? undefined : JSON.parse(v); }
      catch (e) { return undefined; }
    },
    set: function (k, v) { try { localStorage.setItem('ac:' + k, JSON.stringify(v)); } catch (e) {} },
    remove: function (k) { try { localStorage.removeItem('ac:' + k); } catch (e) {} }
  };

  /* ---------- Valores ---------- */
  AC.brl = function (n) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  /* Total sem centavos quando inteiro: R$ 4.700 */
  AC.brlTotal = function (n) {
    return Number.isInteger(n) ? 'R$ ' + n.toLocaleString('pt-BR') : AC.brl(n);
  };

  var U = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  var T = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  var C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function ate99(n) {
    if (n < 20) return U[n];
    var d = Math.floor(n / 10), u = n % 10;
    return T[d] + (u ? ' e ' + U[u] : '');
  }

  function ate999(n) {
    if (n === 100) return 'cem';
    var c = Math.floor(n / 100), r = n % 100, out = [];
    if (c) out.push(C[c]);
    if (r) out.push(ate99(r));
    return out.join(' e ');
  }

  function inteiro(n) {
    if (n < 1000) return ate999(n);
    var m = Math.floor(n / 1000), r = n % 1000;
    var mil = m === 1 ? 'mil' : ate999(m) + ' mil';
    if (!r) return mil;
    return mil + (r < 100 || r % 100 === 0 ? ' e ' : ' ') + ate999(r);
  }

  /* 4700 -> "Quatro mil e setecentos reais" */
  AC.extenso = function (valor) {
    var cents = Math.round(valor * 100), reais = Math.floor(cents / 100), c = cents % 100, parts = [];
    if (reais >= 1000000) return AC.brl(valor);
    if (reais > 0 || !c) parts.push((reais === 0 ? 'zero' : inteiro(reais)) + (reais === 1 ? ' real' : ' reais'));
    if (c) parts.push(ate99(c) + (c === 1 ? ' centavo' : ' centavos'));
    var s = parts.join(' e ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  /* ---------- Contrato: qual é a próxima etapa do assistente ---------- */
  AC.nextContractStep = function () {
    if (!AC.store.get('contrato:dados')) return 'contrato-dados.html';
    if (!AC.store.get('contrato:servicos')) return 'contrato-servicos.html';
    return 'contrato-conferencia.html';
  };

  /* ---------- Validação ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function cpfOk(v) {
    v = v.replace(/\D/g, '');
    if (v.length !== 11 || /^(\d)\1+$/.test(v)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += +v[i] * (t + 1 - i);
      if (+v[t] !== (s * 10) % 11 % 10) return false;
    }
    return true;
  }

  function checkField(f) {
    var rules = (f.dataset.rules || '').split(' ').filter(Boolean);
    var isCb = f.type === 'checkbox';
    var v = isCb ? f.checked : f.value.trim();
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r === 'required' && !v) return f.tagName === 'SELECT' ? 'Selecione uma opção.' : 'Preencha este campo.';
      if (r === 'checked' && !v) return f.dataset.msg || 'Marque esta opção para continuar.';
      if (r === 'email' && v && !EMAIL.test(v)) return 'Informe um e-mail válido.';
      if (r === 'min8' && v && v.length < 8) return 'Use pelo menos 8 caracteres.';
      if (r === 'cpf' && v && !cpfOk(v)) return 'Informe um CPF válido.';
      if (r === 'phone' && v && !/^\(\d{2}\) \d{4,5}-\d{4}$/.test(v)) return 'Informe um telefone com DDD.';
      if (r.indexOf('match:') === 0 && v && v !== document.getElementById(r.slice(6)).value) return 'As senhas não coincidem.';
      if (r === 'future' && v) {
        var d = new Date(v + 'T00:00:00'), today = new Date();
        today.setHours(0, 0, 0, 0);
        if (d < today) return 'Escolha uma data a partir de hoje.';
      }
    }
    return '';
  }

  function paint(f) {
    var msg = checkField(f);
    if (f.type === 'checkbox') {
      var wrap = f.closest('.check');
      if (wrap) wrap.classList.toggle('is-invalid', !!msg);
      return msg;
    }
    var errId = f.getAttribute('aria-describedby');
    var err = errId && document.getElementById(errId);
    if (err) err.textContent = msg;
    f.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return msg;
  }

  /* Valida só no envio (e revalida ao digitar depois de um erro):
     validar no blur deslocava o layout e engolia o clique no botão. */
  AC.bindForm = function (form, onValid) {
    var fields = [].slice.call(form.querySelectorAll('[data-rules]'));
    fields.forEach(function (f) {
      f.addEventListener('input', function () {
        if (f.getAttribute('aria-invalid') === 'true') paint(f);
      });
      f.addEventListener('change', function () {
        if (f.type === 'checkbox' || f.tagName === 'SELECT') paint(f);
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      fields.forEach(function (f) { if (paint(f) && !firstBad) firstBad = f; });
      if (firstBad) return firstBad.focus();
      onValid(form, AC.formData(form));
    });
  };

  AC.formData = function (form) {
    var out = {};
    [].forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    return out;
  };

  /* Estado de envio do botão principal */
  AC.submitting = function (form, label) {
    var btn = form.querySelector('.form__submit');
    if (!btn) return;
    btn.disabled = true;
    btn.dataset.label = btn.textContent;
    btn.textContent = label;
  };

  AC.idle = function (form) {
    var btn = form.querySelector('.form__submit');
    if (!btn || !btn.dataset.label) return;
    btn.disabled = false;
    btn.textContent = btn.dataset.label;
  };

  /* Botão com contagem regressiva (reenvio de e-mail) */
  AC.cooldown = function (btn, seconds, label) {
    var left = seconds;
    btn.disabled = true;
    (function tick() {
      if (left <= 0) { btn.disabled = false; btn.textContent = label; return; }
      btn.textContent = label + ' (' + left + 's)';
      left--;
      setTimeout(tick, 1000);
    })();
  };

  /* ---------- Máscaras ---------- */
  var MASKS = {
    cpf: function (v) {
      v = v.replace(/\D/g, '').slice(0, 11);
      return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    },
    phone: function (v) {
      v = v.replace(/\D/g, '').slice(0, 11);
      if (v.length <= 2) return v ? '(' + v : '';
      if (v.length <= 6) return '(' + v.slice(0, 2) + ') ' + v.slice(2);
      if (v.length <= 10) return '(' + v.slice(0, 2) + ') ' + v.slice(2, 6) + '-' + v.slice(6);
      return '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
    }
  };

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.mask && MASKS[t.dataset.mask]) t.value = MASKS[t.dataset.mask](t.value);
  });

  /* ---------- Mostrar/ocultar senha (delegado) ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    var input = document.getElementById(btn.dataset.toggle);
    var hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    btn.setAttribute('aria-label', hidden ? 'Ocultar senha' : 'Mostrar senha');
    btn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#' + (hidden ? 'i-eye-off' : 'i-eye') + '"/></svg>';
  });

  /* ---------- Sessão / logout ---------- */
  AC.logout = function () {
    // TODO: chamar o endpoint de logout da API (encerrar a sessão/cookie).
    AC.store.remove('sessao');
    AC.store.remove('perfil');
    location.href = 'acesso.html';
  };

  function logoutDialog() {
    var d = document.getElementById('ac-logout');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'ac-logout';
    d.className = 'dialog';
    d.setAttribute('aria-labelledby', 'ac-logout-title');
    d.innerHTML =
      '<h2 class="heading-serif heading-serif--md" id="ac-logout-title">Sair da conta?</h2>' +
      '<p class="text-muted dialog__text">Você precisará entrar novamente para continuar a jornada.</p>' +
      '<div class="dialog__actions">' +
      '<button class="btn btn--secondary" type="button" data-cancel>Cancelar</button>' +
      '<button class="btn btn--primary" type="button" data-confirm>Sair</button>' +
      '</div>';
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-cancel]')) d.close();
      if (e.target.closest('[data-confirm]')) AC.logout();
    });
    document.body.appendChild(d);
    return d;
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-logout]')) logoutDialog().showModal();
  });

  /* ---------- Nome do casal ---------- */
  AC.couple = function () {
    var p = AC.store.get('perfil');
    if (p && p.nome1 && p.nome2) return p.nome1.split(' ')[0] + ' & ' + p.nome2.split(' ')[0];
    return 'Marina & Rafael';
  };

  document.addEventListener('DOMContentLoaded', function () {
    [].forEach.call(document.querySelectorAll('[data-couple]'), function (el) { el.textContent = AC.couple(); });
  });
})();

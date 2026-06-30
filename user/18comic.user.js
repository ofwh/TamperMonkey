// ==UserScript==
// @name         禁漫
// @namespace    http://tampermonkey.net/
// @version      2026-06-30
// @description  try to remove popup ad!
// @author       You
// @match        https://18comic.com/*
// @match        https://18comic.vip/*
// @match        https://18comic.org/*
// @connect      18comic.com
// @connect      18comic.vip
// @connect      18comic.org
// @downloadURL  https://github.com/ofwh/TamperMonkey/raw/master/user/18comic.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=18comic.vip
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /**
   * ==========================
   * 规则配置
   * ==========================
   */
  const RULES = [
    {
      id: 'remove-ad',
      enabled: true,

      // 扫描范围
      scope: 'div.hidden-lg',

      // 是否命中
      match({ element }) {
        return Array.from(element.querySelectorAll('div.group-notice')).some(
          (item) => item.textContent.trim() === 'AD',
        );
      },

      // 命中后的处理
      action({ element }) {
        element.remove();
      },
    },

    {
      id: 'remove-billboard-modal',
      enabled: true,

      // 扫描范围
      scope: 'div#billboard-modal',

      // 存在即命中
      match() {
        return true;
      },

      // 同时移除遮罩层
      action({ element }) {
        element.remove();

        document.querySelectorAll('div.modal-backdrop').forEach((item) => item.remove());
      },
    },
  ];

  /**
   * ==========================
   * 扫描器
   * ==========================
   */
  function scanPage() {
    for (const rule of RULES) {
      if (!rule.enabled) {
        continue;
      }

      const elements = document.querySelectorAll(rule.scope);

      for (const element of elements) {
        const context = {
          element,
          rule,
          document,
          window,
        };

        if (!rule.match(context)) {
          continue;
        }

        rule.action(context);
      }
    }
  }

  /**
   * ==========================
   * MutationObserver
   * ==========================
   */
  let scheduled = false;

  const observer = new MutationObserver(() => {
    // 同一事件循环仅扫描一次
    if (scheduled) {
      return;
    }

    scheduled = true;

    queueMicrotask(() => {
      scheduled = false;
      scanPage();
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 首次扫描
  scanPage();

  // 如需停止监听：
  // observer.disconnect();
})();

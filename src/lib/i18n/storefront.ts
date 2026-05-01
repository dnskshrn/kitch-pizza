export type Lang = "RU" | "RO"

export const DEFAULT_LANG: Lang = "RO"
export const LANG_STORAGE_KEY = "lang"

export type LocalizedText = {
  name_ru: string
  name_ro: string
}

export type LocalizedDescription = {
  description_ru: string | null
  description_ro: string | null
}

export type StorefrontMessages = (typeof messages)[Lang]
export type PromoErrorMessages = StorefrontMessages["promoErrors"]

export function normalizeLang(value: unknown): Lang {
  return value === "RO" ? "RO" : "RU"
}

export function htmlLang(lang: Lang): "ru" | "ro" {
  return lang === "RO" ? "ro" : "ru"
}

export function pickLocalizedName<T extends LocalizedText>(
  value: T,
  lang: Lang,
): string {
  return lang === "RO" ? value.name_ro : value.name_ru
}

export function pickLocalizedDescription<T extends LocalizedDescription>(
  value: T,
  lang: Lang,
): string | null {
  return lang === "RO" ? value.description_ro : value.description_ru
}

export function formatMoney(bani: number, lang: Lang): string {
  const formatted = (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return lang === "RO" ? `${formatted} lei` : `${formatted} лей`
}

export function formatMoneyValue(bani: number): string {
  return (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function formatWeightGrams(grams: number, lang: Lang): string {
  return lang === "RO" ? `${grams}g` : `${grams}гр`
}

export function goodsPhrase(count: number, lang: Lang): string {
  if (lang === "RO") {
    return count === 1 ? `${count} produs` : `${count} produse`
  }

  const abs = count % 100
  const digit = count % 10
  if (abs > 10 && abs < 20) return `${count} товаров`
  if (digit === 1) return `${count} товар`
  if (digit >= 2 && digit <= 4) return `${count} товара`
  return `${count} товаров`
}

export function promoErrorMessage(
  error: { code: keyof PromoErrorMessages; minOrderBani?: number },
  lang: Lang,
): string {
  const t = messages[lang].promoErrors
  if (error.code === "min_order_not_met") {
    return t.min_order_not_met(formatMoney(error.minOrderBani ?? 0, lang))
  }

  const message = t[error.code]
  return typeof message === "string" ? message : t.unknown
}

export const messages = {
  RU: {
    common: {
      ru: "RU",
      ro: "RO",
      close: "Закрыть",
      back: "Назад",
      home: "На главную",
      loading: "Загрузка…",
      noPhoto: "Нет фото",
      noImage: "Нет изображения",
      free: "Бесплатно",
      choose: "Выбрать",
      select: "Выбрать",
      menu: "Меню",
      promotions: "Акции",
      contacts: "Контакты",
      schedule: "График работы",
      phoneNumber: "079 700 290",
      pickupAddress: "bd. Dacia 27, Chișinău",
      callPhone: "Позвонить 079 700 290",
      brandHome: (brandName: string) => `${brandName} — на главную`,
    },
    nav: {
      work: "Работа в Kitch!",
      about: "О нас",
      contacts: "Контакты",
      cashback: "Кэшбек и бонусы",
      review: "Оставить отзыв",
    },
    header: {
      deliveryTitle: "Доставляем пиццу",
      deliveryArea: "Ботаника",
      etaPrefix: "Привезем за",
      etaSuffix: "мин",
      deliveryAddress: "Адрес доставки",
      addressPlaceholder: "Укажите ваш адрес",
      pickupShort: "Самовывоз · bd. Dacia 27",
      theSpotFallbackAddress: "str. Dacia 35",
      openMenu: "Открыть меню",
      closeMenu: "Закрыть меню",
      navigationLabel: "Навигация The Spot",
    },
    menu: {
      featuredTitle: "Новое и популярное",
      featuredPrev: "Прокрутить назад",
      featuredNext: "Прокрутить вперед",
      chooseProduct: "Выбрать товар",
      choose: "Выбрать",
      from: "от",
      promotion: "Акция",
      previousPromotion: "Предыдущая акция",
      nextPromotion: "Следующая акция",
      tags: {
        deal: "выгодно",
        new: "новый",
        hit: "хит",
        spicy: "острое",
        vegan: "веган",
        lean: "постное",
      },
    },
    product: {
      addToCart: "В корзину",
      close: "Закрыть",
      defaultSizeS: "30см",
      defaultSizeL: "33см",
    },
    cart: {
      empty: "Корзина пуста",
      addToOrder: "Добавить к заказу?",
      sauces: "Соусы",
      drinks: "Напитки",
      promoAndDetails: "Промокод и детали заказа",
      promoPlaceholder: "Промокод",
      promoAria: "Промокод",
      promoApplied: (code: string) => `Промокод ${code} применён`,
      removePromo: "Убрать промокод",
      applyPromo: "Применить",
      subtotal: "Товары",
      discount: "Скидка",
      delivery: "Доставка",
      total: "Итого",
      checkout: "К оформлению",
      closeCart: "Закрыть корзину",
      edit: "Изменить",
      remove: "Удалить",
      decrease: "Уменьшить количество",
      increase: "Увеличить количество",
    },
    promoErrors: {
      not_found: "Промокод не найден",
      inactive: "Промокод недействителен",
      expired: "Срок действия промокода истёк",
      not_started: "Промокод ещё не активен",
      limit_reached: "Промокод больше не действует",
      min_order_not_met: (amount: string) => `Минимальная сумма заказа: ${amount}`,
      unknown: "Не удалось применить промокод",
      check_failed: "Не удалось проверить промокод",
    },
    delivery: {
      modeGroup: "Способ получения заказа",
      delivery: "Доставка",
      pickup: "Самовывоз",
      title: "Адрес доставки",
      enterAddress: "Введите адрес",
      locateMe: "Моё местоположение",
      outOfZoneTitle: "Мы еще не открылись в вашем районе!",
      outOfZoneText:
        "Мы разделили город на сектора и благодаря этому оптимизировали нашу доставку...",
      entrance: "Подъезд",
      floor: "Этаж",
      apartment: "Квартира",
      intercom: "Домофон",
      comment: "Комментарий",
      deliveryTime: "Время доставки",
      minOrder: "Мин. заказ",
      deliveryCost: "Стоимость доставки",
      freeFrom: "Бесплатно от",
      choose: "Выбрать",
      pickupTitle: "Самовывоз",
    },
    checkout: {
      stepsLabel: "Этапы оформления заказа",
      stepCart: "Корзина",
      stepCheckout: "Оформление заказа",
      stepSent: "Заказ отправлен",
      loading: "Загрузка…",
      backToCart: "Вернуться в корзину",
      contactTitle: "Ваши данные",
      nameLabel: "Ваше имя",
      namePlaceholder: "Имя",
      phoneLabel: "Телефон",
      phonePlaceholder: "Номер телефона",
      phoneRepeatLabel: "Повторите телефон",
      phoneRepeatPlaceholder: "Повторите номер",
      addressTitle: "Адрес доставки",
      pickupTitle: "Самовывоз",
      changeAddress: "Изменить",
      deliveryTimeTitle: "Время доставки",
      asap: "Как можно скорее",
      scheduled: "Ко времени",
      chooseTime: "Выбрать время",
      promoTitle: "Промокод",
      paymentTitle: "Оплата",
      cash: "Наличные",
      card: "Картой курьеру",
      changeQuestion: "С какой купюры потребуется сдача?",
      changePlaceholder: "Например, 500",
      commentTitle: "Комментарий к заказу",
      commentPlaceholder: "Комментарий",
      submit: "Оформить заказ",
      orderContent: "Содержимое заказа",
      deliveryCost: "Стоимость доставки",
      orderTotal: "Сумма заказа",
      submitFailed: "Не удалось отправить заказ",
      validation: {
        nameRequired: "Укажите имя",
        phoneRequired: "Укажите телефон",
        phoneRepeatRequired: "Повторите номер",
        phoneMismatch: "Номера не совпадают",
        addressRequired: "Укажите адрес доставки",
        zoneRequired: "Выберите адрес в зоне доставки",
      },
      deliveryAddress: {
        pickup: "Самовывоз — bd. Dacia 27",
        entrance: "Подъезд",
        floor: "Этаж",
        apartment: "Квартира",
        intercom: "Домофон",
        empty: "-",
      },
    },
    orderErrors: {
      nameRequired: "Укажите имя",
      phoneRequired: "Укажите телефон",
      emptyCart: "Корзина пуста",
      serverUnavailable: "Сервер временно недоступен",
      saveOrderFailed: "Не удалось сохранить заказ",
      saveItemsFailed: "Не удалось сохранить состав заказа",
    },
    success: {
      titleWithName: (name: string) => `Заказ отправлен, ${name}!`,
      title: "Заказ отправлен!",
      willCall: "Скоро наберем",
      phoneHelp: "Вот наш номер телефона, если вдруг возникнут вопросы!",
      backToMenu: "Вернуться в меню",
    },
    auth: {
      signIn: "Войти",
      title: "Вход",
      phone: "Телефон",
      code: "Код из SMS",
      sendCode: "Получить код",
      verify: "Подтвердить",
      resend: "Отправить ещё раз",
    },
  },
  RO: {
    common: {
      ru: "RU",
      ro: "RO",
      close: "Închide",
      back: "Înapoi",
      home: "Acasă",
      loading: "Se încarcă…",
      noPhoto: "Fără foto",
      noImage: "Fără imagine",
      free: "Gratis",
      choose: "Alege",
      select: "Selectează",
      menu: "Meniu",
      promotions: "Promoții",
      contacts: "Contacte",
      schedule: "Program de lucru",
      phoneNumber: "079 700 290",
      pickupAddress: "bd. Dacia 27, Chișinău",
      callPhone: "Sună la 079 700 290",
      brandHome: (brandName: string) => `${brandName} — acasă`,
    },
    nav: {
      work: "Cariere la Kitch!",
      about: "Despre noi",
      contacts: "Contacte",
      cashback: "Cashback și bonusuri",
      review: "Lasă o recenzie",
    },
    header: {
      deliveryTitle: "Livrăm pizza",
      deliveryArea: "Botanica",
      etaPrefix: "Ajunge în",
      etaSuffix: "min",
      deliveryAddress: "Adresa de livrare",
      addressPlaceholder: "Indicați adresa",
      pickupShort: "Ridicare · bd. Dacia 27",
      theSpotFallbackAddress: "str. Dacia 35",
      openMenu: "Deschide meniul",
      closeMenu: "Închide meniul",
      navigationLabel: "Navigare The Spot",
    },
    menu: {
      featuredTitle: "Nou și popular",
      featuredPrev: "Derulează înapoi",
      featuredNext: "Derulează înainte",
      chooseProduct: "Alege produsul",
      choose: "Alege",
      from: "de la",
      promotion: "Promoție",
      previousPromotion: "Promoția precedentă",
      nextPromotion: "Promoția următoare",
      tags: {
        deal: "avantajos",
        new: "nou",
        hit: "hit",
        spicy: "picant",
        vegan: "vegan",
        lean: "de post",
      },
    },
    product: {
      addToCart: "În coș",
      close: "Închide",
      defaultSizeS: "30cm",
      defaultSizeL: "33cm",
    },
    cart: {
      empty: "Coșul este gol",
      addToOrder: "Adaugi la comandă?",
      sauces: "Sosuri",
      drinks: "Băuturi",
      promoAndDetails: "Promocod și detalii comandă",
      promoPlaceholder: "Promocod",
      promoAria: "Promocod",
      promoApplied: (code: string) => `Promocodul ${code} a fost aplicat`,
      removePromo: "Elimină promocodul",
      applyPromo: "Aplică",
      subtotal: "Produse",
      discount: "Reducere",
      delivery: "Livrare",
      total: "Total",
      checkout: "Spre checkout",
      closeCart: "Închide coșul",
      edit: "Modifică",
      remove: "Șterge",
      decrease: "Micșorează cantitatea",
      increase: "Mărește cantitatea",
    },
    promoErrors: {
      not_found: "Promocodul nu a fost găsit",
      inactive: "Promocodul nu este valid",
      expired: "Promocodul a expirat",
      not_started: "Promocodul încă nu este activ",
      limit_reached: "Promocodul nu mai este disponibil",
      min_order_not_met: (amount: string) => `Suma minimă a comenzii: ${amount}`,
      unknown: "Nu am putut aplica promocodul",
      check_failed: "Nu am putut verifica promocodul",
    },
    delivery: {
      modeGroup: "Mod de primire a comenzii",
      delivery: "Livrare",
      pickup: "Ridicare",
      title: "Adresa de livrare",
      enterAddress: "Introduceți adresa",
      locateMe: "Locația mea",
      outOfZoneTitle: "Încă nu am deschis în zona ta!",
      outOfZoneText:
        "Am împărțit orașul pe sectoare și astfel am optimizat livrarea noastră...",
      entrance: "Scara",
      floor: "Etaj",
      apartment: "Apartament",
      intercom: "Interfon",
      comment: "Comentariu",
      deliveryTime: "Timp livrare",
      minOrder: "Comandă min.",
      deliveryCost: "Cost livrare",
      freeFrom: "Gratis de la",
      choose: "Alege",
      pickupTitle: "Ridicare",
    },
    checkout: {
      stepsLabel: "Etapele comenzii",
      stepCart: "Coș",
      stepCheckout: "Finalizare comandă",
      stepSent: "Comandă trimisă",
      loading: "Se încarcă…",
      backToCart: "Înapoi la coș",
      contactTitle: "Datele tale",
      nameLabel: "Numele tău",
      namePlaceholder: "Nume",
      phoneLabel: "Telefon",
      phonePlaceholder: "Număr de telefon",
      phoneRepeatLabel: "Repetă telefonul",
      phoneRepeatPlaceholder: "Repetă numărul",
      addressTitle: "Adresa de livrare",
      pickupTitle: "Ridicare",
      changeAddress: "Modifică",
      deliveryTimeTitle: "Ora livrării",
      asap: "Cât mai curând",
      scheduled: "La o oră aleasă",
      chooseTime: "Alege ora",
      promoTitle: "Promocod",
      paymentTitle: "Plată",
      cash: "Numerar",
      card: "Cu cardul la curier",
      changeQuestion: "Din ce bancnotă aveți nevoie de rest?",
      changePlaceholder: "De exemplu, 500",
      commentTitle: "Comentariu la comandă",
      commentPlaceholder: "Comentariu",
      submit: "Trimite comanda",
      orderContent: "Conținutul comenzii",
      deliveryCost: "Costul livrării",
      orderTotal: "Suma comenzii",
      submitFailed: "Nu am putut trimite comanda",
      validation: {
        nameRequired: "Introduceți numele",
        phoneRequired: "Introduceți telefonul",
        phoneRepeatRequired: "Repetați numărul",
        phoneMismatch: "Numerele nu coincid",
        addressRequired: "Introduceți adresa de livrare",
        zoneRequired: "Alegeți o adresă în zona de livrare",
      },
      deliveryAddress: {
        pickup: "Ridicare — bd. Dacia 27",
        entrance: "Scara",
        floor: "Etaj",
        apartment: "Apartament",
        intercom: "Interfon",
        empty: "-",
      },
    },
    orderErrors: {
      nameRequired: "Introduceți numele",
      phoneRequired: "Introduceți telefonul",
      emptyCart: "Coșul este gol",
      serverUnavailable: "Serverul este temporar indisponibil",
      saveOrderFailed: "Nu am putut salva comanda",
      saveItemsFailed: "Nu am putut salva conținutul comenzii",
    },
    success: {
      titleWithName: (name: string) => `Comanda a fost trimisă, ${name}!`,
      title: "Comanda a fost trimisă!",
      willCall: "Te sunăm în curând",
      phoneHelp: "Acesta este numărul nostru dacă apar întrebări!",
      backToMenu: "Înapoi la meniu",
    },
    auth: {
      signIn: "Intră",
      title: "Autentificare",
      phone: "Telefon",
      code: "Codul din SMS",
      sendCode: "Primește codul",
      verify: "Confirmă",
      resend: "Trimite din nou",
    },
  },
} as const

export function getMessages(lang: Lang): StorefrontMessages {
  return messages[lang]
}

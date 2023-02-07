var today = new Date()
var seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
random = aleaPRNG(seed)

var state = {
  hp: [],
  similar: [],
  focus: 0,
  n: 1,
  input: ["", ""],
  guesses: [],
  words: [],
  clues: [],
  success: [false, false],
  copied: false,
  help: false,
  helpIndex: 0,
}

api = async (...params) => {
  //console.log(param,value)
  params.push(["md", "spfr"])
  let r = await fetch(`https://api.datamuse.com/words?` + params.map(x => x.join("=")).join("&"))
  let json = await r.json() || []
  return json.filter(x => x.word.split(" ").length == 1
    && x.word.length > 2
    && x.tags
    && Number(x.tags.find(x => x.slice(0, 2) == "f:").slice(2)) >= 1
    && (["n", "N", "v", "adj", "adv", "results_type:primary_rel"].some(p => x.tags.includes(p)))
  ).map(word => ({ ...word, root: word.tags?.find(x => x.slice(0, 5) == "pron:").trim().slice(5).split(" ").reverse() }))
}

var letters = "bcdefghjlmnoprstvw"
getWord = async () => {
  if (!state.words.length) {
    let l = letters[Math.floor(random() * letters.length)]
    let len = Math.floor(random() * 4) + 3
    state.words = await api(["sp", l + Array.from(Array(len)).map(x => "?").join("")])
  }
  state.words = state.words.filter(x => x.score > 1000
    && x.numSyllables < 3
    //&& Number(x.tags.find(x => x.slice(0,2)=="f:").slice(2)) >= 10
    && !(x.root[0] == "NG" && x.numSyllables > 1)
  )
  let i = Math.floor(random() * state.words.length)
  return state.words[i]
}

var attempts = 0
getRhyme = async (word) => {
  //console.log("rhyme", word)
  attempts++
  if (attempts > 4) return
  let rhymes = await api(["rel_rhy", word.word])
  rhymes = rhymes.filter(r => r.numSyllables == word.numSyllables)
  let filtered = rhymes.filter(r => {
    let syl = r.root.findIndex(x => x.length == 3)
    if (r.numSyllables > 1) {
      syl = r.root.findIndex((x, i) => i > syl && x.length == 3)
    }
    return r.score > 1000
      && (Math.abs(r.word.length - word.word.length) < 4)
      && !r.tags.includes("prop")
      && r.root
        .slice(0, syl + 1)
        .every((x, i) => x == word.root[i])
  })
  let i = Math.floor(random() * filtered.length)
  return filtered[i]
}

getClues = async (word) => {
  let c = await api(["ml", word])
  return c.filter(x => !x.word.includes(word) && !word.includes(x.word)).map(x => x.word)
}

getHP = async () => {
  let word = await getWord()
  let rhyme = await getRhyme(word)
  //console.log(word, rhyme)
  if (!rhyme && state.n < 3) {
    //console.log("no rhyme")
    return getHP()
  }
  return [word, rhyme].sort((a, b) => b.tags.includes("adj") - a.tags.includes("adj")).map(x => x?.word)
}

keyPress = letter => {
  if (state.help) return
  if (state.n > 4 || state.success.every(x => x)) return
  if (letter == ">") {
    if (state.focus == 1 || state.focus == 0 && state.success[1]) submit()
    else if (state.focus == 0) state.focus += 1
    return
  }
  if (letter == "<") {
    if (!state.input[state.focus].length && state.focus == 1 && !state.success[0]) {
      state.focus -= 1
      return
    }
    state.input[state.focus] = state.input[state.focus].slice(0, -1)
    return
  }
  if (["<", ">"].includes(letter)) return
  if (state.input[state.focus].length == 8 && state.focus == 1) return
  state.input[state.focus] += letter
  if (state.input[state.focus].length == 8 && state.focus == 0) state.focus += 1
}

submit = () => {
  let guess = state.input.map(x => x.toLowerCase()).map((word, i) => {
    let w = { word: word || "-" }
    if (state.similar[i].includes(word)) {
      w.class = "yellow"
    }
    if (word == state.hp[i]) {
      w.class = "green"
      state.success[i] = true
      return w
    }
    state.input[i] = ""
    return w
  })
  state.focus = state.success[0] ? 1 : 0
  if (state.success.every(x => x)) {
    end()
    return false
  }
  state.guesses.push(guess)
  state.n++
  if (state.n > 4) {
    end()
    state.input = state.hp.map(x => x.toUpperCase())
  }
}

end = () => {
  state.focus = 3
  localStorage.setItem("state", JSON.stringify({ hp: state.hp, similar: state.clues.map(x => x.slice(0, state.n).reverse()), n: state.n, guesses: state.guesses, success: state.success, seed }))
  setInterval(() => m.redraw(), 1000)
}

document.addEventListener("keydown", (e) => {
  if (state.help) return state.help = false
  if (state.n > 4 || state.success.every(x => x)) return
  if (e.keyCode > 64 && e.keyCode < 91) {
    keyPress(e.key.toUpperCase())
  }
  if (e.key == "Backspace") keyPress("<")
  if (e.key == "Enter") keyPress(">")
  if (e.key == "Tab") {
    e.preventDefault();
    if (!state.success[1 - state.focus]) state.focus = (1 - state.focus)
    m.redraw()
    return false;
  }
  if (e.key == " " && state.focus == 0 && !state.success[1]) state.focus = 1
  m.redraw()
})

var Nav = {
  view: function (vnode) {
    return m('nav', { class: "bg-gray-900 p-4 w-full font-bold text-2xl text-gray-100 flex justify-between" }, [
      m('div', { class: "grow" }),
      m('div', { class: "grow text-center cursor-pointer", onclick: () => window.location.reload() }, "HINK PINK"),
      m('div', { class: "grow basis-0 text-right" }, m('div', {
        onclick: () => {
          state.help = !state.help
          state.helpIndex = 0
        },
        class: "inline cursor-pointer rounded-full px-2.5 py-0.5 mx-2 border-2 border-white"
      }, "?"))
    ])
  }
}

var Columns = {
  view: function ({attrs: { clues, n, success, guesses, input, focus}}) {
    return [0,1].map(i => m('div', {
      class: "grow basis-0 h-full flex flex-col justify-center"
    }, [
      // Clues
      m('div', { class: "flex flex-col justify-end end grow basis-0 text-center" }, clues[i]?.slice(0, n).map(x => m("div", { class: "h-9 m-1 text-2xl text-gray-100" }, x))),
      // Input
      m("div", {
        class: "w-full text-center",
        onclick: () => { if (!success[i] && n < 5 && !state.help ) state.focus = i }
      }, m('div', {
        class: [
          "border-4 font-bold text-3xl my-1 rounded font-bold uppercase h-11",
          success[i]
            ? "bg-green-600 border-green-600 text-gray-100"
            : (n > 4 || success.every(x => x))
              ? 'bg-gray-500 border-gray-500 text-gray-900'
              : "bg-white text-black cursor-pointer",
          focus == i ? "border-sky-600" : "",
          i ? 'ml-2 mr-4' : 'mr-2 ml-4'
        ].join(' ')
      }, input[i])),
      // Guesses
      m('div', { class: "grow basis-0 flex flex-col justify-start text-center" }, guesses.map(x => m("div", {
        class: [
          x[i].class == "yellow"
            ? "bg-yellow-600 border-yellow-600 text-gray-900"
            : x[i].class == "green"
              ? "bg-green-600 border-green-600 text-gray-100"
              : "bg-gray-500 border-gray-500 text-gray-900",
          "border-4 font-bold my-1 rounded uppercase",
          i ? 'ml-2 mr-4' : 'mr-2 ml-4'
        ].join(' ')
      }, x[i].word)).reverse()),
    ]))
  }
}

var Result = {
  view: function() {
    let now = new Date()
    let next = [23 - now.getHours(), 59 - now.getMinutes(), 59 - now.getSeconds()]
    if (now.getDate() != today.getDate()) window.location.reload();
    return [
      !(navigator?.share || navigator?.clipboard) || m('div', m('button', {
        class: "bg-sky-600 px-4 py-2 text-2xl rounded-xl font-bold text-white",
        onclick: () => {
          let squares = [
            ...state.guesses.map(g => g.map(x => x.class)),
            ...(state.success.every(x => x) ? [["green", "green"]] : [])
          ].map(g => g.map(x => {
            if (x == "green") return "🟩"
            if (x == "yellow") return "🟨"
            return "⬛"
          }).join(""))
            .reverse()
          let text = `Hink Pink ${squares.length}/4\n${squares.join("\n")}\n${window.location.origin + window.location.pathname}`
          console.log(text)
          if (navigator?.share) {
            navigator.share({ text })
          } else if (navigator?.clipboard) {
            navigator.clipboard.writeText(text);
            state.copied = true
            setTimeout(() => { state.copied = false; m.redraw() }, 1000)
          }
        }
      }, state.copied ? "COPIED" : "SHARE")),
      m('div', { class: "text-white my-2 text-lg font-bold grow flex flex-col justify-center" }, next.some(x => x)
        ? m('div', [`Next in`, m('span', { class: "font-mono ml-1.5" }, next.map((x, i) => i ? x.toString().padStart(2, '0') : x).join(":"))])
        : "Refresh"
      ),
    ]
  }
}

var Keyboard = {
  view: function() {
    return ["QWERTYUIOP", "ASDFGHJKL", ">ZXCVBNM<"].map((row, ri) => m('div', {
      class: "w-full inline-flex justify-center"
    }, row.split('').map((l, i) => {
      let arrows = ri == 2 && (i == 0 || i == (row.length - 1))
      return m('button', {
        class: [
          arrows
            ? "bg-sky-600 w-16 items-center" + (i == 0 ? "" : " text-xl")
            : "py-2.5 px-2.5 text-xl",
          "m-0.5 rounded bg-gray-500 font-bold text-white font-mono flex justify-center",
        ].join(' '),
        onclick: () => keyPress(l)
      }, arrows
        ? i == 0
          ? "ENTER"
          : m.trust(`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" /></svg>`)
        : l)
    })))
  }
}

let example = [
  {
    text: `Given the clue "cloud friend", you might guess the rhyme is SKY GUY.`,
    clues: [["cloud","mist"],["friend", "puppy"]],
    n: 1,
    success: [false, false],
    guesses: [],
    input: ["SKY", "GUY"]
  },
  {
    text: `We were close with SKY, but GUY was way off. The new clue, "mist puppy" might make things more clear`,
    clues: [["cloud","mist"],["friend", "puppy"]],
    n: 2,
    success: [false, false],
    guesses: [[{word: "sky", class:"yellow"}, {word: "guy"}]],
    input: []
  },
  {
    text: `Let's try FOG DOG`,
    clues: [["cloud","mist"],["friend", "puppy"]],
    n: 2,
    success: [false, false],
    guesses: [[{word: "sky", class:"yellow"}, {word: "guy"}]],
    input: ["FOG", "DOG"]
  },
  {
    text: `Got it!`,
    clues: [["cloud","mist"],["friend", "puppy"]],
    n: 3,
    success: [true, true],
    guesses: [[{word: "sky", class:"yellow"}, {word: "guy"}]],
    input: ["FOG", "DOG"]
  }
]

var Help = {
  view: function() {
    return m('div', { class: "absolute top-16 w-full flex justify-center" }, m('div', { class: "max-w-md bg-slate-700 rounded-lg m-4 px-6 py-2 border-2 border-slate-200 text-white" }, [
      m('div', { class: "text-lg font-bold mb-2" }, "How to play"),
      m('ul', { class: "list-disc" }, [
        "Guess the rhyme in 4 tries.",
        "You are given a clue for each word in the rhyme. Listed at the top.",
        "Incorrect guesses give you more clues.",
        ["If your guess is related to the rhyme word, it will be marked in ", m('span', { class: "bg-yellow-600 border-yellow-600 text-gray-900 py-0.5 px-1 rounded font-bold" }, "YELLOW")],
        ["Correct answers are marked in ", m('span', { class: "bg-green-600 border-green-600 text-gray-100 py-0.5 px-1 rounded font-bold" }, "GREEN")],
      ].map(x => m('li', { class: "ml-4 my-1" }, x))),
      m('div', { class: "text-lg font-bold mt-6 mb-2 text-center" }, "Example"),
      m('div', {class:"text-center h-16 mb-4 flex flex-col justify-center"}, example[state.helpIndex].text),
      m('div', {class:"h-24 flex items-center my-2"}, m('div',{class:"w-full"}, m('div', {class:" border-4 border-gray-1s00 rounded-lg py-2 px-4 scale-50 h-1/2 flex justify-center"}, m(Columns, example[state.helpIndex])))),
      m('div', {class:"text-center mt-4"}, m('button', {
        class:"bg-sky-600 font-bold px-2 py-1 rounded-lg",
        onclick: () =>  (state.helpIndex < (example.length-1)) ? (state.helpIndex += 1) : (state.help = false),
      }, (state.helpIndex < (example.length-1)) ? "NEXT" : "CLOSE")),
      m('div', { class: "mt-4" }, ["Words are sourced from the ", m('a', { class: "underline text-sky-500", target: "_blank", href: "https://www.datamuse.com/api/" }, "Datamuse API"), "."])
    ]))
  }
}

var App = {
  view: function () {
    let cluepool = state.similar.map((words, i) => words.filter((word, wi) => {
      gi = state.guesses.map(x => x[i].word).findIndex(g => g == word)
      return gi == -1 || gi > wi
    })
    )
    state.clues = cluepool.map((x, i) => x.slice(0, 4).reverse().map((word, wi) => {
      gi = state.guesses.map(x => x[i]).findIndex(g => g.class == "green")
      return (gi > -1 && wi >= (gi + 1)) ? "" : word
    }))
    return m('div', { class: "flex flex-col h-full w-screen" }, [
      m(Nav),
      m('div', { class: "grow", onclick:()=>(!state.help || (state.help = !state.help))}, m('div', { class: "max-w-md m-auto flex flex-col justify-center h-full text-center" }, [
        m('div', { class: "flex grow overflow-x-auto text-center justify-center w-full" }, m(Columns, {clues: state.clues, n: state.n, success: state.success, guesses:state.guesses, input:state.input, focus:state.focus})),
        m('div', { class: "w-full my-4 h-40 flex flex-col" }, 
          !state.hp.length || ((state.n > 4 || state.success.every(x => x))
            ? m(Result)
            : m(Keyboard))
        )
      ])),
      !state.help || m(Help)
    ])
  }
}

m.mount(document.body, App);

(async () => {
  let store = JSON.parse(localStorage.getItem("state") || "{}")
  if (store.hp && store.seed == seed) {
    state.hp = store.hp
    state.similar = store.similar
    state.n = (store.n || 1)
    state.guesses = (store.guesses || [])
    state.success = (store.success || [false, false])
    state.input = ((state.n > 4 || state.success.every(x => x)) ? state.hp : ["", ""]).map(x => x.toUpperCase())
    state.focus = ((state.n > 4 || state.success.every(x => x)) ? 3 : 0)
  } else {
    state.hp = await getHP()
    state.similar = [await getClues(state.hp[0]), await getClues(state.hp[1])]
    localStorage.setItem("state", JSON.stringify({ hp: state.hp, similar: state.similar, seed }))
  }
  if (state.n > 4 || state.success.every(x => x)) {
    setInterval(() => m.redraw(), 1000)
  }
  m.redraw();
})()
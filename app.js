var today = new Date()
var seed = (new URLSearchParams(window.location.search)).get("s") || today.getFullYear()*10000 + (today.getMonth()+1)*100 + today.getDate()
random = aleaPRNG(seed)

var hp = []
var similar = []
var focus = 0
var n = 1
var input = ["",""]
var guesses = []
var words = []
var clues = []
var success = [false, false]
let copied = false

api = async(...params) => {
  //console.log(param,value)
  params.push(["md", "spfr"])
  let r = await fetch(`https://api.datamuse.com/words?`+params.map(x => x.join("=")).join("&"))
  let json = await r.json() || []
  return json.filter(x => x.word.split(" ").length == 1
    && x.word.length > 2 
    && x.tags 
    && Number(x.tags.find(x => x.slice(0,2)=="f:").slice(2)) >= 1
    && (["n","N","v","adj","adv","results_type:primary_rel"].some(p => x.tags.includes(p)))
  ).map(word => ({...word, root: word.tags?.find(x => x.slice(0,5) == "pron:").trim().split(" ").slice(1).reverse()}))
}
var letters = "bcdefghjlmnoprstvw"
var n = 0
getWord = async()=>{
  if (!words.length) {
    let l = letters[Math.floor(random()*letters.length)]
    let len = Math.floor(random()*4)+3
    words = await api(["sp", l+Array.from(Array(len)).map(x => "?").join("")])
  }
  words = words.filter(x => x.score > 1000 && x.numSyllables < 3)
  i = Math.floor(random()*words.length)
  return words[i]
}

getRhyme = async(word)=>{
  console.log("rhyme", word)
  n++
  if (n > 1) return
  let rhymes = await api(["rel_rhy", word.word])
  rhymes = rhymes.filter(r => r.numSyllables == word.numSyllables)
  filtered = rhymes.filter(r => r.score > 1000
    && (Math.abs(r.word.length - word.word.length) < 4)
    && !r.tags.includes("prop")
    && r.root
      .slice(0,r.root.findIndex(x => x.length == 3)+(r.numSyllables-1))
      .every((x,i) => x == word.root[i])
  )
  i = Math.floor(random()*filtered.length)
  return filtered[i]
}

getClues = async(word) => {
  let c = await api(["ml", word])
  return c.filter(x => !x.word.includes(word) && !word.includes(x.word)).map(x => x.word)
}

getHP = async() => {
    let word = await getWord()
    rhyme = await getRhyme(word)
    console.log(word, rhyme)
    if (!rhyme && n < 3 ) {
      console.log("no rhyme")
      return getHP()
    }
    return [word, rhyme].sort((a,b) => b.tags.includes("adj") - a.tags.includes("adj")).map(x => x?.word)
}
keyPress = letter => {
  if (n > 4 || success.every(x =>x)) return
  if (letter == ">") {
    if (focus == 1 || focus == 0 && success[1]) submit()
    else if (focus == 0) focus += 1
    return
  }
  if (letter == "<") {
    if (!input[focus].length && focus == 1 && !success[0]) {
      focus-=1 
      return
    }
    input[focus] = input[focus].slice(0,-1)
    return
  }
  if (["<",">"].includes(letter)) return
  if (input[focus].length == 8 && focus == 1) return
  input[focus]+=letter
  if (input[focus].length == 8 && focus == 0) focus+=1
}

submit = () => {
  guess = input.map(x => x.toLowerCase()).map((word, i) => {
    let w = {word: word || "-"}
    if (similar[i].includes(word)) {
      w.class = "yellow"
    }
    if (word == hp[i]) {
      w.class = "green"
      success[i] = true
      return w
    }
    input[i] = ""
    return w
  })
  focus = success[0] ? 1 : 0
  if (success.every(x=>x)) {
    end()
    return false
  }
  guesses.push(guess)
  n++
  if (n > 4){
    end()
    input = hp.map(x => x.toUpperCase())
  }
}

end = () => {
  focus = 3
  localStorage.setItem("state", JSON.stringify({hp, similar: clues.map(x => x.slice(0,n).reverse()), n, guesses, success}))
}

document.addEventListener("keydown", (e)=>{
  if (n > 4 || success.every(x =>x)) return
  if (e.keyCode > 64 && e.keyCode < 91) {
    keyPress(e.key.toUpperCase())
  }
  if (e.key == "Backspace") keyPress("<")
  if (e.key == "Enter") keyPress(">")
  if (e.key == "Tab") {
    e.preventDefault();
    if (!success[1-focus]) focus = (1-focus)
    m.redraw()
    return false;
  }
  if (e.key == " " && focus == 0 && !success[1]) focus = 1
  m.redraw()
})
m.mount(document.body, {
  view: function() {
      let cluepool = similar.map((words, i)=>words.filter((word,wi) => {
        gi = guesses.map(x => x[i].word).findIndex(g => g == word)
        return gi == -1 || gi > wi
      }))
      let now = new Date()
      let next = [24-now.getHours()-1, 60-now.getMinutes(), 60-now.getSeconds()]
      if (now.getDate() != today.getDate()) window.location.reload();
      clues = cluepool.map(x => x.slice(0,4).reverse())
      return m('div', {class:"max-w-md flex flex-col m-auto justify-center h-full text-center"}, [
        m('div', {class:"bg-gray-900 p-1 w-full font-bold text-gray-100"}, "HINK PINK"),
        m('div',{class:"flex grow overflow-x-auto text-center justify-center w-full"}, hp.map((w,i)=>m('div', { 
          class: "grow basis-0 h-full flex flex-col justify-center"
        }, [
          m('div',{class: "flex flex-col justify-end end grow basis-0"}, clues[i].slice(0,n).map(x => m("div",{ class: "m-1 text-2xl text-gray-100"}, x))),
          m("div", {id: i, 
            class: ["w-full"].join(' '),
            onclick: ()=>{if (!success[i] && n < 5) focus=i}
          }, m('div',{class: [
            "border-4 font-bold text-3xl my-1 rounded font-bold uppercase h-10",
            success[i] 
              ? "bg-green-600 border-green-600 text-gray-100" 
              : (n > 4 || success.every(x => x)) 
                ? 'bg-gray-500 border-gray-500 text-gray-900' 
                : "bg-white text-black",
            focus == i ? "border-sky-600" : "",
            i ? 'ml-2 mr-4' : 'mr-2 ml-4'
          ].join(' ')}, input[i])),
          m('div',{class: "grow basis-0 flex flex-col justify-start"}, guesses.map(x => m("div",{class: [
            x[i].class == "yellow" 
              ? "bg-yellow-600 border-yellow-600 text-gray-900"
              : x[i].class == "green"
                ? "bg-green-600 border-green-600 text-gray-100"
                : "bg-gray-500 border-gray-500 text-gray-900",
            "border-4 font-bold my-1 rounded uppercase",
            i ? 'ml-2 mr-4' : 'mr-2 ml-4'
          ].join(' ')}, x[i].word)).reverse()),
        ]))
        .reduce((a,b,i)=>{
          a.push(b)
          if (i==0) a.push(m('div', ((false && (n>4 || success.every(x=>x)))) ? m('input',{
            type: "submit", value:"share",
            onclick: ()=>window.location.href = (window.location.origin+"/?s="+Math.floor(Math.random()*10000))
          }):""))
          return a
        }, [])),
        m('div', {class: "w-full my-4 h-40 flex flex-col"}, !hp.length || ((n > 4 || success.every(x => x))
          ? [
            m('div', m('button',{
              class:"bg-sky-600 px-4 py-2 text-2xl rounded-xl font-bold text-white",
              onclick: () => {
                let squares = [
                  ...guesses.map(g => g.map(x => x.class)),
                  ...(success.every(x=>x) ? [["green","green"]] : [])
                ].map( g => g.map( x => {
                  if (x == "green") return "🟩"
                  if (x == "yellow") return "🟨"
                  return "⬛"
                }).join(""))
                .reverse()
                let text = `Hink Pink ${squares.length}/4\n${squares.join("\n")}\n${window.location.origin+window.location.pathname}`
                console.log(text)
                if (navigator?.share) {
                  navigator.share({ text })
                } else if (navigator?.clipboard) {
                  navigator.clipboard.writeText(text);
                  copied = true
                  setTimeout(() => { copied = false; m.redraw() }, 1000)
                }
              }
            }, copied ? "COPIED":"SHARE")),
            m('div', {class: "text-white my-2 text-lg font-bold grow flex flex-col justify-center"}, next.some(x => x) 
            ? `Next in ${next.map((x,i) => i ? x.toString().padStart(2,'0'):x).join(":")}`
            : "Refresh"
            ),
          ]
          : ["QWERTYUIOP","ASDFGHJKL", ">ZXCVBNM<"].map((row, ri) => m('div', {
            class: "w-full inline-flex justify-center"
          }, row.split('').map((l,i) => {
            let arrows = ri == 2 && (i == 0 || i == (row.length-1))
            return m('button', {
              class: [
                arrows 
                  ? "bg-sky-600 w-16 items-center" + (i == 0 ? "" : " text-xl")
                  : "py-2.5 px-2.5 text-xl",
                "m-0.5 rounded bg-gray-500 font-bold text-white font-mono flex justify-center",
              ].join(' '),
              onclick: ()=>keyPress(l)}, arrows
              ? i  == 0 
                ? "ENTER"
                : m.trust(`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" /></svg>`)
              : l)
          }))))
        )
      ])
  }
})
main = async() => {
  let store = JSON.parse(localStorage.getItem("state") || "{}")
  if (store.hp) {
    hp = store.hp
    similar = store.similar
    n = (store.n || 1)
    guesses = (store.guesses || [])
    success = (store.success || [false, false])
    input = ((n > 4||success.every(x=>x)) ? hp : ["",""]).map(x => x.toUpperCase())
    focus = ((n>4||success.every(x=>x)) ? 3 : 0)
  } else {
    hp = await getHP()
    similar = [await getClues(hp[0]), await getClues(hp[1])]
    localStorage.setItem("state", JSON.stringify({hp, similar}))
  }
  if (n > 4 || success.every(x => x)) {
    setInterval(()=>m.redraw(),1000)
  }
  m.redraw();
}
main()
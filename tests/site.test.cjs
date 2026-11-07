const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function html(name) { return fs.readFileSync(name, 'utf8'); }
function script(name) {
  const match = html(name).match(/<script>([\s\S]*?)<\/script>/);
  assert(match, 'Missing inline script: ' + name);
  return match[1];
}
function mockDom() {
  const elements = {};
  return {
    document: {
      getElementById(id) {
        if (!elements[id]) elements[id] = {
          value: '', textContent: '', innerHTML: '', className: '',
          hidden: false, style: {}, scrollTop: 0, scrollHeight: 0,
          classList: { add() {}, remove() {}, toggle() {} },
          focus() {}, addEventListener() {}
        };
        return elements[id];
      },
      querySelectorAll() { return []; }
    },
    elements
  };
}
function runWithDom(name, expose, extras = {}) {
  const {document, elements} = mockDom();
  const local = new Map();
  const localStorage = {
    getItem(k) { return local.get(k) ?? null; },
    setItem(k,v) { local.set(k,String(v)); }
  };
  const context = vm.createContext({document, localStorage, console, ...extras});
  const code = script(name) + '\n;globalThis.__testExports = {' + expose + '};';
  new vm.Script(code, {filename:name}).runInContext(context, {timeout:3000});
  return {api:context.__testExports, elements};
}
function check() {
  const index = html('index.html');
  const guide = fs.readFileSync('content.js','utf8');
  assert(!/\bCVS\b/i.test(index+guide), 'CVS should not be present');
  for (const page of ['index.html','playground.html','missions.html','branch-lab.html','quizzes.html']) {
    assert(html(page).includes('favicon.svg'), 'Favicon missing on '+page);
    new vm.Script(script(page),{filename:page});
    console.log('✓ Script syntax: '+page);
  }
  for (const link of ['playground.html','missions.html','branch-lab.html','quizzes.html']) {
    assert(index.includes(link), 'Missing nav to '+link);
  }
  const dataset = JSON.parse(index.split('const DATA=')[1].split(';\nconst KEY=')[0]);
  const guides = JSON.parse(guide.replace(/^window.VCA_GUIDES=/,'').replace(/;\s*$/,''));
  assert.equal(dataset.modules.length,9);
  assert.equal(dataset.modules.reduce((n,m)=>n+m.lessons.length,0),36);
  assert.equal(dataset.labs.length,30);
  assert.equal(guides.lessons.length,36);
  assert.equal(guides.labs.length,30);
  for (const l of dataset.labs) assert(guides.labs.some(g=>g.id===l.id),'Missing guide '+l.id);
  console.log('✓ Content and lab mappings');

  const git = runWithDom('playground.html','getInstructions: instructions, cmdRun, getState:()=>state');
  const sequence = git.api.getInstructions.map(x=>x.cmd);
  for(const command of sequence) assert(git.api.cmdRun(command).ok,'Command failed: '+command);
  assert.equal(git.api.getState().commits.length,1);
  assert.equal(git.api.getState().files['README.md'],'Hello Git\n');
  console.log('✓ First-commit simulator: '+sequence.length+' steps');

  const branch = runWithDom('branch-lab.html','tasks, execute, getState:()=>state');
  for(const [command] of branch.api.tasks) assert(branch.api.execute(command).ok,'Branch command failed: '+command);
  const state = branch.api.getState();
  assert.equal(state.commits.length,4);
  assert.equal(state.files['app.js'],'let price = 110;\n');
  assert.equal(state.commits.at(-1).parents.length,2);
  console.log('✓ Branching simulator: merge conflict and two-parent merge');

  const mission = runWithDom('missions.html','missions, switchMission, choose, advance, getState:()=>({step,selected,complete})');
  for(let m=0;m<mission.api.missions.length;m++){
    mission.api.switchMission(m);
    for(const q of mission.api.missions[m].steps){
      const wrong=(q.correct+1)%q.options.length;
      mission.api.choose(wrong);
      assert.equal(mission.api.getState().selected,wrong);
      mission.api.choose(q.correct);
      assert.equal(mission.api.getState().selected,q.correct);
      mission.api.advance();
    }
  }
  assert.equal(Object.values(mission.api.getState().complete).length,4);
  console.log('✓ Engineering missions: 12 correct/wrong/retry paths');

  const quiz = runWithDom('quizzes.html','modules, selectModule, answer, next, getState:()=>({m,n,correct,scores})');
  assert.equal(quiz.api.modules.length,9);
  for(let m=0;m<quiz.api.modules.length;m++){
    quiz.api.selectModule(m);
    for (const q of quiz.api.modules[m].questions) {
      quiz.api.answer(q.correct);
      quiz.api.next();
    }
    assert.equal(quiz.api.getState().scores[m+1].score,3);
  }
  console.log('✓ Module quizzes: 27 scored answers');
  console.log('All site checks passed.');
}
check();

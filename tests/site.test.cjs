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
  for (const page of ['index.html','playground.html','missions.html','branch-lab.html','quizzes.html','actions-lab.html','workspace.html']) {
    assert(html(page).includes('favicon.svg'), 'Favicon missing on '+page);
    new vm.Script(script(page),{filename:page});
    console.log('✓ Script syntax: '+page);
  }
  for (const link of ['playground.html','missions.html','branch-lab.html','quizzes.html','actions-lab.html','workspace.html']) {
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

  const actions = runWithDom('actions-lab.html','SCENARIOS, execute');
  assert.equal(actions.api.SCENARIOS.length,4);
  const repaired = [
    actions.api.SCENARIOS[0].starter.replace('needs: compile','needs: build'),
    actions.api.SCENARIOS[1].starter.replace('npm run test:unit','npm test'),
    actions.api.SCENARIOS[2].starter.replace('permissions: write-all','permissions:\n  contents: read'),
    actions.api.SCENARIOS[3].starter.replace('  deploy:\n    runs-on:', '  deploy:\n    needs: test\n    environment: github-pages\n    permissions:\n      pages: write\n      id-token: write\n    runs-on:')
  ];
  for(let i=0;i<4;i++){
    const original = actions.api.execute(actions.api.SCENARIOS[i].starter,i);
    assert.equal(original.evaluation.passed,false,'Broken starter should not pass mission '+i);
    const solved = actions.api.execute(repaired[i],i);
    assert.equal(solved.evaluation.passed,true,'Corrected workflow should pass mission '+i+': '+solved.simulation.parsed.errors.join(', '));
    assert(solved.simulation.graph.every(j=>j.status==='success'), 'Solved jobs failed on mission '+i);
  }
  const bad = actions.api.execute(repaired[0].replace('needs: build','needs: nonexistent'),0);
  assert.equal(bad.evaluation.passed,false);
  assert(bad.simulation.parsed.errors.some(e=>e.includes('unknown needs target')));
  console.log('✓ Actions YAML lab: four failures, four verified fixes, invalid dependency');


  const workspaceContext = vm.createContext({});
  new vm.Script(fs.readFileSync('workspace-engine.js','utf8'),{filename:'workspace-engine.js'}).runInContext(workspaceContext);
  const workspaceEngine = workspaceContext.GitWorkspaceEngine.create();
  assert.equal(workspaceEngine.suggested().step,0);
  assert.equal(workspaceEngine.command('gh pr merge').ok,false);
  assert.equal(workspaceEngine.command('git switch -c feature/welcome').ok,true);
  assert.equal(workspaceEngine.suggested().step,1);
  assert.equal(workspaceEngine.edit('app.js','console.log("Hello, Git!");\n').ok,true);
  assert.equal(workspaceEngine.suggested().step,2);
  assert.equal(workspaceEngine.command('git status').ok,true);
  assert.equal(workspaceEngine.command('git add app.js').ok,true);
  assert.equal(workspaceEngine.suggested().step,3);
  assert.equal(workspaceEngine.command('git diff --cached').ok,true);
  assert.equal(workspaceEngine.command('git commit -m "Update greeting"').ok,true);
  assert.equal(workspaceEngine.suggested().step,4);
  assert.equal(workspaceEngine.command('git push -u origin feature/welcome').ok,true);
  assert.equal(workspaceEngine.suggested().step,5);
  assert.equal(workspaceEngine.command('gh pr create --fill').ok,true);
  assert.equal(workspaceEngine.command('gh pr merge').ok,false,'PR must require reviewer approval');
  assert.equal(workspaceEngine.checkPR().ok,true);
  assert.equal(workspaceEngine.command('gh pr review --approve').ok,true);
  assert.equal(workspaceEngine.command('gh pr merge').ok,true);
  let workspaceState=workspaceEngine.snapshot();
  assert.equal(workspaceState.pr.merged,true);
  assert.notEqual(workspaceState.branches.main,workspaceState.remote.branches.main,'Local main should not automatically advance');
  assert.equal(workspaceState.commits[workspaceState.pr.mergeCommit].parents.length,2);
  assert.equal(workspaceEngine.command('git switch main').ok,true);
  assert.equal(workspaceEngine.command('git fetch origin').ok,true);
  assert.equal(workspaceEngine.command('git pull --ff-only').ok,true);
  workspaceState=workspaceEngine.snapshot();
  assert.equal(workspaceState.branches.main,workspaceState.remote.branches.main);
  assert.equal(workspaceState.working['app.js'],'console.log("Hello, Git!");\n');
  assert.equal(workspaceEngine.suggested().step,9);
  assert.equal(workspaceContext.GitWorkspaceEngine.create(workspaceState).snapshot().pr.merged,true);
  const unchangedCount=Object.keys(workspaceState.commits).length;
  assert.equal(workspaceEngine.command('git commit -m "Nothing"').ok,false);
  assert.equal(Object.keys(workspaceEngine.snapshot().commits).length,unchangedCount);
  const failedCI=workspaceContext.GitWorkspaceEngine.create();
  assert.equal(failedCI.command('git switch -c feature/broken').ok,true);
  failedCI.edit('app.js','console.log("Broken");\n');
  failedCI.command('git add app.js');failedCI.command('git commit -m "Broken greeting"');
  failedCI.command('git push -u origin feature/broken');failedCI.command('gh pr create --fill');
  assert.equal(failedCI.checkPR().ok,false);
  assert.equal(failedCI.command('gh pr review --approve').ok,false);
  console.log('✓ Unified Git workspace: edit, stage, commit, remote push, PR approval, merge, fetch, pull and failure paths');


  const collaborative=workspaceContext.GitWorkspaceEngine.create();
  function runCollab(cmd){const r=collaborative.command(cmd);assert.equal(r.ok,true,cmd+': '+r.message);return r}
  runCollab('git switch -c feature/welcome');
  assert.equal(collaborative.edit('app.js','console.log("Hello, Git!");\n').ok,true);
  runCollab('git add app.js');
  runCollab('git commit -m "Alice updates greeting"');
  runCollab('git push -u origin feature/welcome');
  runCollab('gh pr create --fill');
  assert.equal(collaborative.collaboratorPush().ok,true);
  assert.equal(collaborative.collaboratorPush().ok,false,'Bob should only push once in the guided scenario');
  assert.equal(collaborative.mergeability().ok,false,'Concurrent same-line change should block remote merge');
  assert.equal(collaborative.command('gh pr review --approve').ok,true,'Review may be recorded but merging still requires conflict resolution');
  assert.equal(collaborative.command('gh pr merge').ok,false,'An unresolved conflict must never reach origin/main');
  assert.equal(collaborative.snapshot().remoteTracking.main,'c001','Bob push must not silently update tracking refs');
  runCollab('git fetch origin');
  assert.equal(collaborative.snapshot().remoteTracking.main,collaborative.snapshot().remote.branches.main);
  runCollab('git merge origin/main');
  assert.deepEqual(Array.from(collaborative.snapshot().merge.conflicts),['app.js']);
  assert.match(collaborative.snapshot().working['app.js'],/<<<<<<< HEAD/);
  assert.equal(collaborative.command('git add app.js').ok,false,'Unresolved markers must not be accepted');
  assert.equal(collaborative.command('git commit -m "Skip resolution"').ok,false);
  runCollab('git merge --abort');
  assert.equal(collaborative.snapshot().merge,null);
  assert.equal(collaborative.snapshot().working['app.js'],'console.log("Hello, Git!");\n');
  runCollab('git merge origin/main');
  assert.equal(collaborative.edit('app.js','console.log("Hello, Git!");\nconsole.log("Hello from Bob!");\n').ok,true);
  runCollab('git add app.js');
  runCollab('git commit -m "Resolve competing greetings"');
  let collabState=collaborative.snapshot();
  assert.equal(collabState.merge,null);
  assert.deepEqual(Array.from(collabState.commits[collabState.branches[collabState.head]].parents),['c002','c003']);
  assert.equal(collaborative.mergeability().ok,false,'PR still points at stale pushed branch');
  runCollab('git push -u origin feature/welcome');
  assert.equal(collaborative.mergeability().ok,true);
  assert.equal(collaborative.snapshot().pr.approved,false,'Updating PR invalidates stale approval');
  runCollab('gh pr review --approve');
  runCollab('gh pr merge');
  runCollab('git switch main');
  runCollab('git fetch origin');
  runCollab('git pull --ff-only');
  collabState=collaborative.snapshot();
  assert.equal(collabState.branches.main,collabState.remote.branches.main);
  assert.match(collabState.working['app.js'],/Hello from Bob/);
  assert.match(collabState.working['app.js'],/Hello, Git/);
  assert.equal(collaborative.suggested().step,9);
  assert.equal(workspaceContext.GitWorkspaceEngine.create(collabState).snapshot().collaborator.commit,'c003');
  console.log('✓ Multi-developer Git: conflict blocking, stale refs, merge abort, marker rejection, two-parent resolution, PR review and remote merge');

  console.log('All site checks passed.');
}
check();

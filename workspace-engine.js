(function(root){
"use strict";
const DEFAULT_FILES={"app.js":'console.log("Hello, world!");\n',"README.md":"# Hello App\nAn example project for learning Git.\n"};
function copy(x){return JSON.parse(JSON.stringify(x))}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function initial(){
 const first={id:"c001",parents:[],message:"Initial project",files:copy(DEFAULT_FILES)};
 return {version:1,next:2,commits:{c001:first},branches:{main:"c001"},head:"main",
  remote:{name:"origin",branches:{main:"c001"}},remoteTracking:{main:"c001"},working:copy(DEFAULT_FILES),stage:{},pr:null,merge:null,collaborator:null,events:[],last:"",author:"Learner"};
}
function create(input){
 let state=input&&input.version===1?copy(input):initial();
 if(!state.remoteTracking)state.remoteTracking=copy(state.remote.branches);
 if(!Object.prototype.hasOwnProperty.call(state,"merge"))state.merge=null;
 if(!Object.prototype.hasOwnProperty.call(state,"collaborator"))state.collaborator=null;
 function commit(id){return state.commits[id]||null}
 function active(){return state.branches[state.head]}
 function filesAt(id){return id&&commit(id)?copy(commit(id).files):{}}
 function tracked(){return filesAt(active())}
 function addEvent(text){state.events.push(text);state.events=state.events.slice(-35);state.last=text}
 function clean(){return !state.merge&&same(tracked(),state.working)&&Object.keys(state.stage).length===0}
 function result(ok,message){addEvent(message);return {ok,message,state:copy(state)}}
 function commonAncestor(a,b){let seen=new Set(),stack=[a];while(stack.length){let id=stack.pop();if(!id||seen.has(id))continue;seen.add(id);let item=commit(id);if(item)stack.push(...item.parents)}
  let queue=[b],visited=new Set();while(queue.length){let id=queue.shift();if(!id||visited.has(id))continue;if(seen.has(id))return id;visited.add(id);let item=commit(id);if(item)queue.push(...item.parents)}return null}
 function ancestor(a,b){return commonAncestor(a,b)===a}
 function changes(base,tip){const a=filesAt(base),b=filesAt(tip),out=[];for(const name of new Set([...Object.keys(a),...Object.keys(b)])){if(a[name]!==b[name])out.push({name,before:a[name]??null,after:b[name]??null})}return out}
 function freshCommit(files,message,parents){const id="c"+String(state.next++).padStart(3,"0");state.commits[id]={id,files:copy(files),parents:parents.filter(Boolean),message};return id}

 function mergeability(){
  const p=state.pr;if(!p||p.merged)return {ok:false,reason:"There is no open PR."};
  const main=state.remote.branches.main,feature=state.remote.branches[p.branch];
  if(!feature)return {ok:false,reason:"Feature branch has not been pushed."};
  const base=commonAncestor(main,feature),a=filesAt(main),b=filesAt(feature),original=filesAt(base);
  const conflicted=Object.keys({...original,...a,...b}).filter(n=>a[n]!==original[n]&&b[n]!==original[n]&&a[n]!==b[n]);
  return conflicted.length?{ok:false,reason:"Conflict in "+conflicted.join(", ")+". Fetch and merge origin/main into the feature branch before resolving and pushing.",conflicts:conflicted}:{ok:true,reason:"Branches can be merged."};
 }
 function collaboratorPush(){
  const p=state.pr;if(!p||p.merged)return result(false,"Open your feature PR before simulating Bob's concurrent work.");
  if(state.collaborator)return result(false,"Bob already pushed a competing change in this exercise.");
  const old=state.remote.branches.main,files=filesAt(old);
  files["app.js"]='console.log("Hello from Bob!");\n';
  const id=freshCommit(files,"Bob: change welcome message",[old]);
  state.remote.branches.main=id;state.collaborator={name:"Bob",commit:id,branch:"main"};p.approved=false;
  return result(true,"Bob pushed "+id+" to origin/main. He edited the same line independently. Your local branches and origin/main tracking ref have not updated. Fetch to discover his change.");
 }
 function checkPR(){const p=state.pr;if(!p)return null;const base=state.remote.branches.main,tip=state.remote.branches[p.branch];
  if(!tip)return {ok:false,reason:"The feature branch has not been pushed."};
  const diff=changes(commonAncestor(base,tip),tip),source=filesAt(tip)["app.js"]||"";
  if(!diff.length)return {ok:false,reason:"No changes found compared with main."};
  if(!source.includes('console.log("Hello, Git!");'))return {ok:false,reason:'Test failed: app.js must print "Hello, Git!".'};
  if(/TODO|FIXME/.test(source))return {ok:false,reason:"Lint check failed: remove TODO/FIXME markers."};
  return {ok:true,reason:"CI passed: greeting assertion and basic lint check.",diff}
 }
 function edit(name,content){if(!["app.js","README.md"].includes(name))return result(false,"Only app.js and README.md can be edited in this exercise.");
  if(typeof content!=="string"||content.length>10000)return result(false,"Please keep file contents under 10,000 characters.");
  state.working[name]=content;return result(true,"Edited "+name+" in your working directory. The commit and remote are unchanged.");
 }
 function prCreate(){
  if(state.head==="main")return result(false,"Create and switch to a feature branch before opening a PR.");
  const branch=state.head,tip=state.remote.branches[branch];
  if(!tip)return result(false,"Push "+branch+" to origin before opening a PR.");
  if(state.pr&&!state.pr.merged)return result(false,"An open pull request already exists. Review it instead.");
  if(!changes(commonAncestor(state.remote.branches.main,tip),tip).length)return result(false,"There are no changes to propose.");
  state.pr={number:1,branch,base:"main",title:"Improve welcome greeting",approved:false,merged:false,mergeCommit:null};
  const check=checkPR();return result(true,"Opened simulated PR #1: "+branch+" → main. "+check.reason);
 }
 function approve(){
  if(!state.pr||state.pr.merged)return result(false,"Open a pull request before reviewing it.");
  const check=checkPR();if(!check.ok)return result(false,"Cannot approve while CI fails: "+check.reason);
  state.pr.approved=true;return result(true,"Simulated reviewer approved PR #1. The pull request is ready to merge.");
 }
 function mergePR(){
  const p=state.pr;if(!p||p.merged)return result(false,"No open pull request is available.");
  if(!p.approved)return result(false,"Branch protection: an independent reviewer approval is required.");
  const mergeCheck=mergeability();if(!mergeCheck.ok)return result(false,"Cannot merge PR: "+mergeCheck.reason);
  const check=checkPR();if(!check.ok)return result(false,"Branch protection: "+check.reason);
  const main=state.remote.branches.main,feature=state.remote.branches[p.branch];
  if(!ancestor(commonAncestor(main,feature),main))return result(false,"The base branch history could not be verified.");
  const base=commonAncestor(main,feature),baseFiles=filesAt(base),a=filesAt(main),b=filesAt(feature),merged=copy(a);
  for(const name of new Set([...Object.keys(baseFiles),...Object.keys(a),...Object.keys(b)])){
    if(a[name]!==baseFiles[name]&&b[name]!==baseFiles[name]&&a[name]!==b[name])return result(false,"Remote merge conflict in "+name+". Update the feature branch first.");
    if(b[name]!==baseFiles[name]){if(b[name]===undefined)delete merged[name];else merged[name]=b[name]}
  }
  const id=freshCommit(merged,"Merge pull request #1 from "+p.branch,[main,feature]);
  state.remote.branches.main=id;p.merged=true;p.mergeCommit=id;
  return result(true,"PR #1 merged on origin/main as "+id+". Your local main remains unchanged until you fetch and integrate.");
 }
 function command(line){
  const raw=String(line||"").trim(),cmd=raw.replace(/\s+/g," ");if(!cmd)return result(false,"Enter a command.");
  if(cmd==="help")return result(true,"Commands: git status, git diff, git diff --cached, git branch, git log --oneline, git switch, git add, git commit -m, git push -u origin, git fetch origin, git merge origin/main, git merge --abort, git pull --ff-only, gh pr create, gh pr review --approve, gh pr merge, git remote -v");
  if(cmd==="git status"){
    const unstage=Object.keys(state.working).filter(k=>state.working[k]!==((Object.prototype.hasOwnProperty.call(state.stage,k))?state.stage[k]:tracked()[k]));
    const stage=Object.keys(state.stage);
    return result(true,"On branch "+state.head+"\n"+(state.merge?"Unmerged paths: resolve conflict markers, stage the resolution and commit.\n":"")+(stage.length?"Changes to be committed: "+stage.join(", ")+"\n":"")+(unstage.length?"Unstaged changes: "+unstage.join(", ")+"\n":"")+(stage.length||unstage.length?"":"nothing to commit, working tree clean"));
  }
  if(cmd==="git branch")return result(true,Object.keys(state.branches).map(b=>(b===state.head?"* ":"  ")+b+" → "+state.branches[b]).join("\n"));
  if(cmd==="git remote -v")return result(true,"origin  https://github.com/example/hello-app.git (simulated fetch/push)");
  if(cmd==="git log --oneline"){let id=active(),entries=[];while(id&&entries.length<20){let c=commit(id);entries.push(c.id+" "+c.message);id=c.parents[0]}return result(true,entries.join("\n"))}
  if(cmd==="git diff"||cmd==="git diff --cached"||cmd==="git diff --staged"){
   const a=cmd==="git diff"?{...tracked(),...state.stage}:tracked(),b=cmd==="git diff"?state.working:{...tracked(),...state.stage};
   const out=[];for(const n of new Set([...Object.keys(a),...Object.keys(b)])){if(a[n]!==b[n])out.push("--- a/"+n+"\n+++ b/"+n+"\n- "+(a[n]||"").trim()+"\n+ "+(b[n]||"").trim())}
   return result(true,out.join("\n")||"No differences.");
  }
  let m=cmd.match(/^git switch -c ([a-zA-Z0-9][a-zA-Z0-9._\/-]*)$/);
  if(m){const n=m[1];if(n==="main"||Object.prototype.hasOwnProperty.call(state.branches,n))return result(false,"Branch already exists.");
   if(!clean())return result(false,"Commit or discard local changes before creating a branch.");
   state.branches[n]=active();state.head=n;return result(true,"Switched to new branch '"+n+"'.");
  }
  m=cmd.match(/^git switch ([a-zA-Z0-9._\/-]+)$/);
  if(m){if(!Object.prototype.hasOwnProperty.call(state.branches,m[1]))return result(false,"Unknown local branch "+m[1]);
   if(!clean())return result(false,"Your working directory is dirty. Commit changes before switching branches.");
   state.head=m[1];state.working=tracked();return result(true,"Switched to branch '"+state.head+"'.");
  }
  if(cmd==="git add ."||cmd==="git add -A"){
   if(state.merge&&Object.values(state.working).some(v=>/^(<<<<<<<|=======|>>>>>>>)/m.test(v)))return result(false,"Remove conflict markers before staging.");
   for(const [n,c] of Object.entries(state.working))state.stage[n]=c;
   return result(true,"Staged working files.");
  }
  m=cmd.match(/^git add (app\.js|README\.md)$/);
  if(m){
   if(state.merge&&/^(<<<<<<<|=======|>>>>>>>)/m.test(state.working[m[1]]||""))return result(false,"Remove conflict markers before staging the resolution.");
   state.stage[m[1]]=state.working[m[1]];
   return result(true,"Staged "+m[1]+(state.merge?" as the merge resolution.":"."));
  }
  m=raw.match(/^git commit -m\s+["']([^"']+)["']$/);
  if(m){
   if(!Object.keys(state.stage).length)return result(false,"Nothing staged. Run git add first.");
   const files={...tracked(),...state.stage};
   if(state.merge){
    if(state.merge.conflicts.some(n=>!Object.prototype.hasOwnProperty.call(state.stage,n)))return result(false,"Stage each conflicted file before committing the merge.");
    if(Object.values(files).some(v=>/^(<<<<<<<|=======|>>>>>>>)/m.test(v)))return result(false,"Conflict markers remain in the staged snapshot.");
    const parents=[state.merge.ours,state.merge.theirs];
    const id=freshCommit(files,m[1],parents);state.branches[state.head]=id;state.stage={};state.merge=null;
    return result(true,"["+state.head+" "+id+"] Merge commit saved with two parents: "+parents.join(", ")+". Push to update the PR.");
   }
   if(same(files,tracked()))return result(false,"Staged content is identical to current HEAD.");
   const id=freshCommit(files,m[1],[active()]);state.branches[state.head]=id;state.stage={};
   return result(true,"["+state.head+" "+id+"] "+m[1]+". Commit saved locally, not on the remote.");
  }
  m=cmd.match(/^git push(?: -u)? origin ([a-zA-Z0-9._\/-]+)$/);
  if(m){const branch=m[1];if(branch!==state.head)return result(false,"Switch to the branch you want to push first.");
   if(!clean())return result(false,"Commit your current edits before pushing this guided exercise.");
   const remoteTip=state.remote.branches[branch];if(remoteTip&&!ancestor(remoteTip,active()))return result(false,"Push rejected: remote has commits you do not have.");
   state.remote.branches[branch]=active();if(state.pr&&!state.pr.merged&&state.pr.branch===branch)state.pr.approved=false;
   return result(true,"Pushed "+branch+" to origin at "+active()+". GitHub can now compare this branch.");
  }
  if(cmd==="git merge --abort"){
   if(!state.merge)return result(false,"There is no merge in progress.");
   state.working=filesAt(state.merge.ours);state.stage={};state.merge=null;
   return result(true,"Merge aborted. Your working tree is restored to the pre-merge commit.");
  }
  if(cmd==="git merge origin/main"){
   if(state.merge)return result(false,"Finish or abort the current merge first.");
   if(!clean())return result(false,"Commit or discard your local edits before merging.");
   const ours=active(),theirs=state.remoteTracking.main;
   if(!theirs)return result(false,"No origin/main ref. Run git fetch origin.");
   if(ancestor(theirs,ours))return result(true,"Already up to date with origin/main.");
   if(ancestor(ours,theirs)){state.branches[state.head]=theirs;state.working=filesAt(theirs);return result(true,"Fast-forwarded to origin/main.");}
   const base=commonAncestor(ours,theirs),a=filesAt(ours),b=filesAt(theirs),original=filesAt(base),files=copy(a),conflicts=[];
   for(const name of Object.keys({...original,...a,...b})){
    if(a[name]!==original[name]&&b[name]!==original[name]&&a[name]!==b[name]){
      conflicts.push(name);
      files[name]="<<<<<<< HEAD\\n"+(a[name]||"")+"=======\\n"+(b[name]||"")+">>>>>>> origin/main\\n";
    }else if(b[name]!==original[name]){if(b[name]===undefined)delete files[name];else files[name]=b[name]}
   }
   state.working=files;
   if(conflicts.length){
     state.merge={ours,theirs,base,conflicts};
     return result(true,"CONFLICT in "+conflicts.join(", ")+". Edit the file, preserve both approved changes, remove the markers, stage and commit.");
   }
   const id=freshCommit(files,"Merge origin/main",[ours,theirs]);state.branches[state.head]=id;state.stage={};
   return result(true,"Merged origin/main, creating merge commit "+id+".");
  }
  if(cmd==="git fetch origin"){state.remoteTracking=copy(state.remote.branches);return result(true,"Fetched origin: updated remote-tracking refs. Local branch and working files are unchanged.");}
  if(cmd==="git pull --ff-only"){if(!clean())return result(false,"Commit or discard changes before pulling.");
   state.remoteTracking=copy(state.remote.branches);const tip=state.remoteTracking[state.head];if(!tip)return result(false,"No upstream branch found on origin.");
   if(!ancestor(active(),tip))return result(false,"Not possible to fast-forward this branch.");
   state.branches[state.head]=tip;state.working=tracked();return result(true,"Fast-forwarded "+state.head+" to "+tip+". Local files now match origin/"+state.head+".");
  }
  if(cmd==="gh pr create"||cmd==="gh pr create --fill")return prCreate();
  if(cmd==="gh pr review --approve")return approve();
  if(cmd==="gh pr merge")return mergePR();
  return result(false,"Unsupported command in this educational simulator. Type help to see the supported subset.");
 }
 function suggested(){
  const p=state.pr,feature=Object.keys(state.branches).find(n=>n!=="main");
  if(state.merge){
    const pending=state.merge.conflicts.filter(n=>!Object.prototype.hasOwnProperty.call(state.stage,n));
    if(pending.length)return {step:6,title:"Resolve Alice and Bob's conflict",command:null,detail:'Edit app.js to include both console.log("Hello, Git!"); and console.log("Hello from Bob!"); on separate lines. Remove all conflict markers, save, and stage app.js.'};
    return {step:6,title:"Commit your merge resolution",command:'git commit -m "Resolve Alice and Bob"',detail:"A merge commit records both parents, preserving each developer's contribution."};
  }
  if(!feature)return {step:0,title:"Create a feature branch",command:"git switch -c feature/welcome",detail:"A feature branch isolates your change from main."};
  if(!p&&state.head!=="main"&&state.branches[state.head]===state.branches.main&&state.working["app.js"]!=='console.log("Hello, Git!");\n')return {step:1,title:"Edit the application",command:null,detail:'Edit app.js to console.log("Hello, Git!");'};
  if(!p&&state.head!=="main"&&Object.keys(state.stage).length===0&&state.branches[state.head]===state.branches.main)return {step:2,title:"Stage your edit",command:"git add app.js",detail:"Stage the desired file before committing."};
  if(!p&&state.head!=="main"&&Object.keys(state.stage).length>0)return {step:3,title:"Commit locally",command:'git commit -m "Update greeting"',detail:"Commit saves your staged change."};
  if(!p&&state.head!=="main"&&!state.remote.branches[state.head])return {step:4,title:"Push feature branch",command:"git push -u origin "+state.head,detail:"Publish your feature commit to the simulated GitHub remote."};
  if(!p)return {step:5,title:"Create a pull request",command:"gh pr create --fill",detail:"Open a proposal to integrate your feature with main."};
  if(state.collaborator&&!p.merged){
    if(state.head!==p.branch)return {step:6,title:"Switch back to your feature branch",command:"git switch "+p.branch,detail:"Resolve the competing change on the feature branch."};
    if(state.remoteTracking.main!==state.remote.branches.main)return {step:6,title:"Fetch Bob's new commit",command:"git fetch origin",detail:"Fetch updates origin/main without altering your local files."};
    if(!ancestor(state.remote.branches.main,active()))return {step:6,title:"Merge Bob's work",command:"git merge origin/main",detail:"Inspect the conflict markers, then decide how to combine both edits."};
    if(state.remote.branches[p.branch]!==active())return {step:6,title:"Push your resolution",command:"git push -u origin "+p.branch,detail:"Push the two-parent merge commit so the PR can be rechecked."};
  }
  if(!p.approved&&!p.merged)return {step:6,title:"Review and approve",command:"gh pr review --approve",detail:"A separate simulated reviewer verifies your changes and checks."};
  if(!p.merged)return {step:7,title:"Merge the PR",command:"gh pr merge",detail:"Approval and conflict-free checks are required before merging."};
  if(state.branches.main!==state.remote.branches.main)return state.head==="main"?{step:8,title:"Update local main",command:"git pull --ff-only",detail:"Pull the reviewed merge into local main."}:{step:8,title:"Return to main",command:"git switch main",detail:"Switch to main before synchronizing."};
  return {step:9,title:"Completed",command:"git log --oneline",detail:"Your local main includes both contributors."};
 }
 function snapshot(){return copy(state)}
 return {command,edit,snapshot,suggested,changes,checkPR,mergeability,collaboratorPush,initial,commonAncestor};
}
root.GitWorkspaceEngine={create,initial};
})(typeof window!=="undefined"?window:globalThis);
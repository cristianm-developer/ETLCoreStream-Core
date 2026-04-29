

export const yieldControl = async () => {
    if(globalThis.sheduler?.yield){
        await globalThis.sheduler.yield();
    } else {
        await new Promise(r => setTimeout(r, 0));
    }   
}
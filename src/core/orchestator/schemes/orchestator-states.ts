
export type OrchestatorStateType =
    | 'initializing'
    | 'idle'
    | 'waiting-layout'
    | 'waiting-file'
    | 'importing'
    | 'mapping'
    | 'handling-local-step'
    | 'persisting'
    | 'handle-global-steps'
    | 'waiting-user'
    | 'waiting-user-with-errors'
    | 'editing-row'
    | 'handle-local-steps-on-edit'
    | 'handle-global-steps-on-edit'
    | 'exporting'
    | 'cleaning'
    | 'unexpected-error';
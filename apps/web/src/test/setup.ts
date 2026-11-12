import {randomUUID} from 'node:crypto'
import {afterEach,vi} from 'vitest'
import {cleanup} from '@testing-library/react'

// jsdom versions do not all expose randomUUID, but the production browser does.
// The editor's IDs must remain unique in component tests as well.
if(typeof globalThis.crypto?.randomUUID!=='function'){
 Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,value:randomUUID})
}
afterEach(()=>{
 cleanup()
 vi.restoreAllMocks()
})

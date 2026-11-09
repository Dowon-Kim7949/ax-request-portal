import { createContext } from 'react'

/**
 * The ids of a notice about the draft shown above the wizard's step (a
 * conflict, a full account). Each step's heading takes focus as it opens, so
 * it is described by the notice: a screen reader hears it then, also when the
 * draft opens that way.
 */
export const StepNotice = createContext<string | undefined>(undefined)

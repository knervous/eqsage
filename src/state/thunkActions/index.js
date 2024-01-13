
import * as asyncActions from './asyncActions';
import * as syncActions from './syncActions';

export const thunkActions = { ...asyncActions, ...syncActions };

/** @typedef {thunkActions} ThunkActionContext */

/** @typedef {{ [T in keyof thunkActions]: function(Parameters<thunkActions[T]>): ReturnType<thunkActions[T]> }} ThunkActionsType */

/**
 * @returns {{ context: ThunkActionContext, thunkActions: ThunkActionsType }}
 */
export const getThunkActions = () => {
  /** @type {ThunkActionContext} */
  const context = { ...thunkActions };
  return {
    context,
    thunkActions: Object.assign(
      {},
      ...Object.entries(thunkActions).map(([name, func]) => ({
        async [name]() {
          try {
            return await func.call(context, ...arguments);
          } catch (e) {
            console.warn(`Error in action ${name}`);
            console.warn(e);
          }
        },
      })),
    ),
  };
};

interface Function {
  bind<T, R>(this: (this: any) => R, thisArgs: T) : (this: T) => R;
  bind<T, R, A0>(this: (this: any, a0: A0) => R, thisArgs: T) : (this: T, a0: A0) => R;
}

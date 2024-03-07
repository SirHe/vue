import { cloneVNode, createVNode } from './vnode'

export function createAppContext() {
    return {
        app: null,
        config: {
            isNativeTag: NO,
            performance: false,
            globalProperties: {},
            optionMergeStrategies: {},
            errorHandler: undefined,
            warnHandler: undefined,
            compilerOptions: {},
        },
        mixins: [],
        components: {},
        directives: {},
        provides: Object.create(null),
        optionsCache: new WeakMap(),
        propsCache: new WeakMap(),
        emitsCache: new WeakMap(),
    }
}


export const createAppAPI = (
    render,
    hydrate
) => (rootComponent) => {
    if (!isFunction(rootComponent)) {
        rootComponent = { ...rootComponent }
    }

    const context = createAppContext()
    const installedPlugins = new WeakSet()

    let isMounted = false // 控制挂载次数

    const app = {
        _uid: uid++,
        _component: rootComponent,
        _props: rootProps,
        _container: null,
        _context: context,
        _instance: null,

        version,

        get config() {
            return context.config
        },

        use(plugin, ...options) {
            if (installedPlugins.has(plugin)) {
                __DEV__ && warn(`Plugin has already been applied to target app.`)
            } else if (plugin && isFunction(plugin.install)) {
                installedPlugins.add(plugin)
                plugin.install(app, ...options)
            } else if (isFunction(plugin)) {
                installedPlugins.add(plugin)
                plugin(app, ...options)
            } else if (__DEV__) {
                warn(
                    `A plugin must either be a function or an object with an "install" ` +
                    `function.`,
                )
            }
            return app
        },

        mixin(mixin) {
            if (__FEATURE_OPTIONS_API__) {
                if (!context.mixins.includes(mixin)) {
                    context.mixins.push(mixin)
                } else if (__DEV__) {
                    warn(
                        'Mixin has already been applied to target app' +
                        (mixin.name ? `: ${mixin.name}` : ''),
                    )
                }
            } else if (__DEV__) {
                warn('Mixins are only available in builds supporting Options API')
            }
            return app
        },

        component(name, component) {
            if (!component) {
                return context.components[name]
            }
            context.components[name] = component
            return app
        },

        directive(name, directive) {
            if (!directive) {
                return context.directives[name]
            }
            context.directives[name] = directive
            return app
        },

        mount(
            rootContainer,
            isHydrate,
            namespace,
        ) {
            if (isMounted) {
                return
            }

            const vnode = createVNode(rootComponent, rootProps)
            // store app context on the root VNode.
            // this will be set on the root instance on initial mount.
            vnode.appContext = context

            if (namespace === true) {
                namespace = 'svg'
            } else if (namespace === false) {
                namespace = undefined
            }

            // HMR root reload
            if (__DEV__) {
                context.reload = () => {
                    // casting to ElementNamespace because TS doesn't guarantee type narrowing
                    // over function boundaries
                    render(
                        cloneVNode(vnode),
                        rootContainer,
                        namespace as ElementNamespace,
                    )
                }
            }

            if (isHydrate && hydrate) {
                hydrate(vnode as VNode<Node, Element>, rootContainer as any)
            } else {
                render(vnode, rootContainer, namespace)
            }
            isMounted = true
            app._container = rootContainer
                // for devtools and telemetry
                ; (rootContainer as any).__vue_app__ = app

            if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
                app._instance = vnode.component
                devtoolsInitApp(app, version)
            }

            return getExposeProxy(vnode.component!) || vnode.component!.proxy

        },

        unmount() {
            if (isMounted) {
                render(null, app._container)
                if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
                    app._instance = null
                    devtoolsUnmountApp(app)
                }
                delete app._container.__vue_app__
            } else if (__DEV__) {
                warn(`Cannot unmount an app that is not mounted.`)
            }
        },

        provide(key, value) {
            if (__DEV__ && (key) in context.provides) {
                warn(
                    `App already provides property with key "${String(key)}". ` +
                    `It will be overwritten with the new value.`,
                )
            }

            context.provides[key] = value

            return app
        },

        runWithContext(fn) {
            currentApp = app
            try {
                return fn()
            } finally {
                currentApp = null
            }
        },
    }

    context.app = app

    if (__COMPAT__) {
        installAppCompatProperties(app, context, render)
    }

    return app
}
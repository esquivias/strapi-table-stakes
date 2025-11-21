import { getTranslation } from './utils/getTranslation';
import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: PLUGIN_ID,
      },
      Component: async () => {
        const { App } = await import('./pages/App');

        return App;
      },
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },

  async bootstrap(app: any) {
    // Inject sidebar panel into content manager
    const contentManagerPlugin = app.getPlugin('content-manager');

    console.log('Content Manager Plugin:', contentManagerPlugin);
    console.log('Available methods:', Object.keys(contentManagerPlugin || {}));
    if (contentManagerPlugin?.apis) {
      console.log('APIs:', Object.keys(contentManagerPlugin.apis));
    }

    if (contentManagerPlugin) {
      // Import the component synchronously at bootstrap time
      const { TasksSidePanel } = await import('./components/TasksSidePanel');

      // Try the correct injection method for Strapi v5
      if (contentManagerPlugin.injectComponent) {
        console.log('Using injectComponent method');
        contentManagerPlugin.injectComponent('editView', 'right-links', {
          name: 'tasks-side-panel',
          Component: TasksSidePanel,
        });
      } else if (contentManagerPlugin.apis?.injectContentManagerComponent) {
        console.log('Using apis.injectContentManagerComponent method');
        contentManagerPlugin.apis.injectContentManagerComponent('editView', 'right-links', {
          name: 'tasks-side-panel',
          Component: TasksSidePanel,
        });
      } else {
        console.warn('Could not find method to inject component into content manager');
        console.warn('Available plugin structure:', contentManagerPlugin);
      }
    }
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);

          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};

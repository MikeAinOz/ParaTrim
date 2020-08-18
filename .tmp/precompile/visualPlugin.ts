import { ParaTrim } from "../../src/paraTrim";
import powerbiVisualsApi from "powerbi-visuals-api"
import IVisualPlugin = powerbiVisualsApi.visuals.plugins.IVisualPlugin
import VisualConstructorOptions = powerbiVisualsApi.extensibility.visual.VisualConstructorOptions
var powerbiKey: any = "powerbi";
var powerbi: any = window[powerbiKey];

var filterAgeDF6D7E350E674FBFBD01E44EB2776482: IVisualPlugin = {
    name: 'filterAgeDF6D7E350E674FBFBD01E44EB2776482',
    displayName: 'ParaTrim1.0.0',
    class: 'ParaTrim',
    apiVersion: '2.6.0',
    create: (options: VisualConstructorOptions) => {
        if (ParaTrim) {
            return new ParaTrim(options);
        }

        throw 'Visual instance not found';
    },
    custom: true
};

if (typeof powerbi !== "undefined") {
    powerbi.visuals = powerbi.visuals || {};
    powerbi.visuals.plugins = powerbi.visuals.plugins || {};
    powerbi.visuals.plugins["filterAgeDF6D7E350E674FBFBD01E44EB2776482"] = filterAgeDF6D7E350E674FBFBD01E44EB2776482;
}

export default filterAgeDF6D7E350E674FBFBD01E44EB2776482;
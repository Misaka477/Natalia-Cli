import {
  createContext,
  createSignal,
  onMount,
  useContext,
  type ParentProps,
} from "solid-js";
import { loadTuiPreferences, saveTuiPreferences } from "../settings";
import { ThemeService } from "../theme/service";
import { defaultTheme, setThemeTokens, type Theme } from "../theme/theme";
import { useToast } from "./toast";

export type ThemeContext = {
  readonly theme: Theme;
  readonly themes: readonly Theme[];
  preview(name: string): boolean;
  commit(name: string): boolean;
};

const ThemeContext = createContext<ThemeContext>();

export function ThemeProvider(props: ParentProps<{ workspaceRoot?: string }>) {
  const toast = useToast();
  const service = new ThemeService(props.workspaceRoot);
  const [theme, setTheme] = createSignal(defaultTheme);
  const [themes, setThemes] = createSignal<Theme[]>([defaultTheme]);

  onMount(() => {
    void Promise.all([
      service.getAllThemes(),
      props.workspaceRoot
        ? loadTuiPreferences(props.workspaceRoot)
        : Promise.resolve(undefined),
    ])
      .then(([available, preferences]) => {
        setThemes(available);
        const selected =
          available.find((item) => item.name === preferences?.theme) ??
          defaultTheme;
        setTheme(selected);
        setThemeTokens(selected);
      })
      .catch(toast.error);
  });

  function preview(name: string) {
    const next = themes().find((item) => item.name === name);
    if (!next) return false;
    setTheme(next);
    setThemeTokens(next);
    return true;
  }

  return (
    <ThemeContext.Provider
      value={{
        get theme() {
          return theme();
        },
        get themes() {
          return themes();
        },
        preview,
        commit(name) {
          if (!preview(name)) return false;
          if (props.workspaceRoot)
            void saveTuiPreferences(
              props.workspaceRoot,
              { theme: name },
              "project",
            ).catch(toast.error);
          return true;
        },
      }}
    >
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within a ThemeProvider");
  return value;
}

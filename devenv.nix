{ pkgs, lib, config, inputs, ... }:

{
  languages.javascript = {
    enable = true;
    bun = {
      enable = true;
      install.enable = true;
    };
    npm.enable = true;
    nodejs.enable = true;
  };

  claude.code.enable = true;
  # See full reference at https://devenv.sh/reference/options/
}

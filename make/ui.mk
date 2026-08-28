# Single responsibility: the CLI look and feel. Defines UI_LIB, a bash block
# evaluated at the top of every recipe via SHELL_LIB.

define UI_LIB
__ui_colors_enabled=0
if [ -t 1 ] && [ -z "$${NO_COLOR:-}" ] && command -v tput >/dev/null 2>&1; then
  __ui_ncolors="$$(tput colors 2>/dev/null || echo 0)"
  if [ "$${__ui_ncolors:-0}" -ge 8 ] 2>/dev/null; then
    __ui_colors_enabled=1
  fi
fi

if [ "$$__ui_colors_enabled" = "1" ]; then
  C_OK="$$(tput setaf 2)"
  C_ERR="$$(tput setaf 1)"
  C_WARN="$$(tput setaf 3)"
  C_INFO="$$(tput setaf 4)"
  C_MUTED="$$(tput setaf 8 2>/dev/null || tput setaf 7)"
  C_BOLD="$$(tput bold)"
  C_RESET="$$(tput sgr0)"
else
  C_OK=""; C_ERR=""; C_WARN=""; C_INFO=""; C_MUTED=""; C_BOLD=""; C_RESET=""
fi

if [ "$${DEV_ASCII:-0}" = "1" ]; then
  SYM_OK="[OK]"; SYM_ERR="[XX]"; SYM_WARN="[!!]"; SYM_INFO="[i]"; SYM_STEP="->"; SYM_DOT="*"; SYM_BULLET="."
else
  SYM_OK="✔"; SYM_ERR="✖"; SYM_WARN="⚠"; SYM_INFO="ℹ"; SYM_STEP="→"; SYM_DOT="●"; SYM_BULLET="·"
fi

ui_title() {
  printf '\n  %s%s%s\n\n' "$$C_BOLD" "$$1" "$$C_RESET"
}

ui_step() {
  printf '  %s%s%s %s %s\n' "$$C_INFO" "$$SYM_STEP" "$$C_RESET" "$$1" "$$2"
}

ui_ok() {
  printf '  %s%s%s %s\n' "$$C_OK" "$$SYM_OK" "$$C_RESET" "$$1"
}

ui_err() {
  printf '  %s%s%s %s\n' "$$C_ERR" "$$SYM_ERR" "$$C_RESET" "$$1"
}

ui_warn() {
  printf '  %s%s%s %s\n' "$$C_WARN" "$$SYM_WARN" "$$C_RESET" "$$1"
}

ui_info() {
  printf '  %s%s%s %s\n' "$$C_INFO" "$$SYM_INFO" "$$C_RESET" "$$1"
}

ui_muted() {
  printf '  %s%s%s\n' "$$C_MUTED" "$$1" "$$C_RESET"
}

ui_elapsed() {
  __ui_start="$$1"
  __ui_now="$$(date +%s)"
  __ui_delta=$$(( __ui_now - __ui_start ))
  if [ "$$__ui_delta" -ge 60 ]; then
    printf '%dm%02ds' $$(( __ui_delta / 60 )) $$(( __ui_delta % 60 ))
  else
    printf '%ds' "$$__ui_delta"
  fi
}

ui_done() {
  __ui_elapsed_str="$$(ui_elapsed "$$3")"
  printf '  %s%s%s %s %s %s(%s)%s\n' "$$C_OK" "$$SYM_OK" "$$C_RESET" "$$1" "$$2" "$$C_MUTED" "$$__ui_elapsed_str" "$$C_RESET"
}

ui_state_color() {
  case "$$1" in
    RUNNING) printf '%s' "$$C_OK" ;;
    STOPPED) printf '%s' "$$C_MUTED" ;;
    STARTING) printf '%s' "$$C_INFO" ;;
    UNHEALTHY) printf '%s' "$$C_ERR" ;;
    *) printf '%s' "$$C_WARN" ;;
  esac
}

ui_state_dot() {
  printf '%s%s%s' "$$(ui_state_color "$$1")" "$$SYM_DOT" "$$C_RESET"
}

# ui_row <name> <kind> <state> <pid> <port> <url> <health> <name_width>
ui_row() {
  __row_name="$$1"; __row_kind="$$2"; __row_state="$$3"; __row_pid="$$4"
  __row_port="$$5"; __row_url="$$6"; __row_health="$$7"; __row_namewidth="$$8"
  [ -n "$$__row_pid" ] || __row_pid="-"
  [ -n "$$__row_port" ] || __row_port="-"
  [ -n "$$__row_url" ] || __row_url="-"
  __row_dot="$$(ui_state_dot "$$__row_state")"
  __row_state_c="$$(printf '%s%s%s' "$$(ui_state_color "$$__row_state")" "$$__row_state" "$$C_RESET")"
  printf '  %s %s' "$$__row_dot" "$$(ui_pad "$$__row_name" "$${#__row_name}" "$$__row_namewidth")"
  printf '%s' "$$(ui_pad "$$__row_kind" "$${#__row_kind}" 8)"
  printf '%s' "$$(ui_pad "$$__row_state_c" "$${#__row_state}" 11)"
  printf '%s' "$$(ui_pad "$$__row_pid" "$${#__row_pid}" 8)"
  printf '%s' "$$(ui_pad "$$__row_port" "$${#__row_port}" 7)"
  printf '%s' "$$(ui_pad "$$__row_url" "$${#__row_url}" 26)"
  printf '%s\n' "$$__row_health"
}

# ui_table_header <name_width>
ui_table_header() {
  __th_namewidth="$$1"
  printf '  %s %s' " " "$$(ui_pad ARTIFACT 8 "$$__th_namewidth")"
  printf '%s' "$$(ui_pad KIND 4 8)"
  printf '%s' "$$(ui_pad STATE 5 11)"
  printf '%s' "$$(ui_pad PID 3 8)"
  printf '%s' "$$(ui_pad PORT 4 7)"
  printf '%s' "$$(ui_pad URL 3 26)"
  printf '%s\n' "HEALTH"
}

# ui_pad <text> <visible_len> <width>: right-pads plain (non ANSI) text.
ui_pad() {
  __ui_pad_text="$$1"
  __ui_pad_len="$$2"
  __ui_pad_width="$$3"
  __ui_pad_n=$$(( __ui_pad_width - __ui_pad_len ))
  if [ "$$__ui_pad_n" -lt 1 ] 2>/dev/null; then __ui_pad_n=1; fi
  printf '%s' "$$__ui_pad_text"
  printf "%$${__ui_pad_n}s" ""
}

ui_fail() {
  __ui_element="$$1"; __ui_reason="$$2"; __ui_log="$$3"; __ui_cmd="$$4"
  printf '\n  %s%s%s %s%s failed%s\n' "$$C_ERR" "$$SYM_ERR" "$$C_RESET" "$$C_BOLD" "$$__ui_element" "$$C_RESET" 1>&2
  printf '    %swhy%s    %s\n' "$$C_MUTED" "$$C_RESET" "$$__ui_reason" 1>&2
  printf '    %slog%s    %s\n' "$$C_MUTED" "$$C_RESET" "$$__ui_log" 1>&2
  printf '    %sinspect%s %s\n\n' "$$C_MUTED" "$$C_RESET" "$$__ui_cmd" 1>&2
}
endef

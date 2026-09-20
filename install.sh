#!/usr/bin/env bash

#############################################################################
# OpenAgents Control - Extra Domains (xdomains) Installer
#
# Copies this repository's xdomains/ tree into <opencode-dir>/xdomains/ so that
# /build-context-system can discover and apply domains.
#
# Run the OAC installer (Advanced profile) FIRST to create the OpenCode dir.
#
# Compatible with:
# - macOS (bash 3.2+)
# - Linux (bash 3.2+)
# - Windows (Git Bash, WSL)
#
# Usage:
#   ./install.sh <destination> [--force]
#   ./install.sh --opencode-dir <path> [--force]
#############################################################################

set -e

# Detect platform
PLATFORM="$(uname -s)"
case "$PLATFORM" in
    Linux*)     PLATFORM="Linux";;
    Darwin*)    PLATFORM="macOS";;
    CYGWIN*|MINGW*|MSYS*) PLATFORM="Windows";;
    *)          PLATFORM="Unknown";;
esac

# Colors for output (disable on Windows if not supported)
if [ "$PLATFORM" = "Windows" ] && [ -z "$WT_SESSION" ] && [ -z "$ConEmuPID" ]; then
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    MAGENTA=''
    CYAN=''
    BOLD=''
    NC=''
else
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m' # No Color
fi

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/xdomains"

# Global variables
DEST_DIR=""
OPENCODE_DIR=""
FORCE=false

#############################################################################
# Utility Functions
#############################################################################

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║        OpenAgents Control - XDomains Installer v0.2.0          ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error()   { echo -e "${RED}✗${NC} $1"; }
print_info()    { echo -e "${BLUE}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_step()    { echo -e "\n${MAGENTA}${BOLD}▶${NC} $1\n"; }

normalize_and_validate_path() {
    local input_path="$1"
    local normalized_path

    if [ -z "$input_path" ]; then
        echo ""
        return 1
    fi

    if [[ $input_path == ~* ]]; then
        normalized_path="${HOME}${input_path:1}"
    else
        normalized_path="$input_path"
    fi

    normalized_path="${normalized_path//\\//}"
    normalized_path="${normalized_path%/}"

    if [[ ! "$normalized_path" = /* ]] && [[ ! "$normalized_path" =~ ^[A-Za-z]: ]]; then
        normalized_path="$(pwd)/${normalized_path}"
    fi

    echo "$normalized_path"
    return 0
}

#############################################################################
# Installation
#############################################################################

install_xdomains() {
    print_step "Resolving destination..."

    if [ ! -d "$SOURCE_DIR" ]; then
        print_error "xdomains folder not found next to this script: $SOURCE_DIR"
        exit 1
    fi

    local opencode_dir=""

    if [ -n "$OPENCODE_DIR" ]; then
        if ! opencode_dir=$(normalize_and_validate_path "$OPENCODE_DIR"); then
            print_error "Invalid OpenCode directory: $OPENCODE_DIR"
            exit 1
        fi
        if [ ! -d "$opencode_dir" ]; then
            print_error "OpenCode directory does not exist: $opencode_dir"
            exit 1
        fi
        print_success "OpenCode directory: $opencode_dir"
    else
        if [ -z "$DEST_DIR" ]; then
            print_error "No destination folder provided"
            echo ""
            echo "Usage: $0 <destination> [--force]"
            echo "       $0 --opencode-dir <path> [--force]"
            echo "Run '$0 --help' for more information"
            exit 1
        fi

        local normalized_path
        if ! normalized_path=$(normalize_and_validate_path "$DEST_DIR"); then
            print_error "Invalid destination: $DEST_DIR"
            exit 1
        fi

        if [ ! -d "$normalized_path" ]; then
            print_error "Destination does not exist: $normalized_path"
            exit 1
        fi
        print_success "Destination: $normalized_path"

        if [ ! -d "$normalized_path/.opencode" ]; then
            print_error "No .opencode folder found in: $normalized_path"
            print_info "Install OpenAgents Control (Advanced profile) first, then run this installer"
            exit 1
        fi
        print_success "Found .opencode folder"
        opencode_dir="$normalized_path/.opencode"
    fi

    local target_dir="$opencode_dir/xdomains"

    if [ -d "$target_dir" ]; then
        if [ "$FORCE" != true ]; then
            print_warning "xdomains already installed at: $target_dir"
            read -r -p "Overwrite existing xdomains? [y/N]: " confirm
            if [[ ! $confirm =~ ^[Yy] ]]; then
                print_info "Installation cancelled"
                exit 0
            fi
        fi
        print_step "Removing existing xdomains..."
        rm -rf "$target_dir"
    fi

    print_step "Installing xdomains..."
    mkdir -p "$target_dir"
    cp -R "$SOURCE_DIR"/. "$target_dir"/

    local file_count
    file_count=$(find "$target_dir" -type f | wc -l | tr -d ' ')

    echo ""
    print_success "XDomains installed!"
    echo -e "  Location: ${CYAN}${target_dir}${NC}"
    echo -e "  Files:    ${GREEN}${file_count}${NC}"
    echo ""
    print_info "Run /build-context-system and choose a domain to apply a sub-domain"
}

#############################################################################
# Main
#############################################################################

main() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --opencode-dir=*)
                OPENCODE_DIR="${1#*=}"
                if [ -z "$OPENCODE_DIR" ]; then
                    echo "Error: --opencode-dir requires a non-empty path"
                    exit 1
                fi
                shift
                ;;
            --opencode-dir)
                if [ -n "$2" ] && [ "${2:0:1}" != "-" ]; then
                    OPENCODE_DIR="$2"
                    shift 2
                else
                    echo "Error: --opencode-dir requires a path argument"
                    exit 1
                fi
                ;;
            --force|-f)
                FORCE=true
                shift
                ;;
            --help|-h|help)
                print_header
                echo "Usage: $0 <destination> [--force]"
                echo "       $0 --opencode-dir <path> [--force]"
                echo ""
                echo -e "${BOLD}Arguments:${NC}"
                echo "  <destination>   Folder containing a .opencode directory"
                echo "                  (xdomains are copied to"
                echo "                  <destination>/.opencode/xdomains)"
                echo ""
                echo -e "${BOLD}Options:${NC}"
                echo "  --opencode-dir PATH"
                echo "                  Install directly into an OpenCode directory that"
                echo "                  may not be named .opencode (e.g. ~/.config/opencode);"
                echo "                  xdomains are copied to <PATH>/xdomains"
                echo "  --force, -f     Overwrite an existing install without prompting"
                echo "  --help, -h      Show this help message"
                echo ""
                echo -e "${BOLD}Examples:${NC}"
                echo -e "  ${CYAN}# Install into the current project${NC}"
                echo "  $0 ."
                echo ""
                echo -e "  ${CYAN}# Reinstall over an existing copy${NC}"
                echo "  $0 . --force"
                echo ""
                exit 0
                ;;
            -*)
                print_error "Unknown option: $1"
                echo "Run '$0 --help' for usage information"
                exit 1
                ;;
            *)
                if [ -n "$DEST_DIR" ]; then
                    print_error "Unexpected argument: $1"
                    echo "Run '$0 --help' for usage information"
                    exit 1
                fi
                DEST_DIR="$1"
                shift
                ;;
        esac
    done

    print_header
    install_xdomains
}

main "$@"

// Fresh templates for script-scaffolding, shader-helper and input-automation.
//
// These templates are authored for OAC. They reimplement only the *data shapes*
// of the old Unity-Developer-Tools utilities (which are CC BY-NC-ND, design
// reference only); no content is copied verbatim.
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { makeResult, type ActOptions } from './shared';
import type { ActBase, ActStatus } from './types';

export interface TemplateEntry {
  language: string;
  defaultName: string;
  fileName: (name: string) => string;
  render: (name: string, namespace: string, options: ActOptions) => string;
}

export interface TemplateResult extends ActBase {
  template: string | null;
  language: string | null;
  fileName: string | null;
  content: string | null;
  written: boolean;
  outPath: string | null;
  available: string[];
}

type Registry = Record<string, TemplateEntry>;

function namespaceWrap(namespace: string, body: string): string {
  if (!namespace) return body;
  const indented = body
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `    ${line}`))
    .join('\n');
  return `namespace ${namespace}\n{\n${indented}\n}\n`;
}

function scriptRegistry(): Registry {
  return {
    monobehaviour: {
      language: 'csharp',
      defaultName: 'NewBehaviour',
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) =>
        namespaceWrap(
          namespace,
          [
            'using UnityEngine;',
            '',
            `public sealed class ${name} : MonoBehaviour`,
            '{',
            '    [SerializeField] private float speed = 5f;',
            '',
            '    private void Awake()',
            '    {',
            '    }',
            '',
            '    private void Update()',
            '    {',
            '        transform.position += Vector3.forward * (speed * Time.deltaTime);',
            '    }',
            '}',
            '',
          ].join('\n')
        ),
    },
    'scriptable-object': {
      language: 'csharp',
      defaultName: 'NewData',
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) =>
        namespaceWrap(
          namespace,
          [
            'using UnityEngine;',
            '',
            '[CreateAssetMenu(menuName = "OAC/' + name + '", fileName = "' + name + '")]',
            `public sealed class ${name} : ScriptableObject`,
            '{',
            '    [SerializeField] private string displayName;',
            '    [SerializeField, TextArea] private string description;',
            '',
            '    public string DisplayName => displayName;',
            '    public string Description => description;',
            '}',
            '',
          ].join('\n')
        ),
    },
    'editor-window': {
      language: 'csharp',
      defaultName: 'NewToolWindow',
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) =>
        namespaceWrap(
          namespace,
          [
            'using UnityEditor;',
            'using UnityEngine;',
            '',
            `public sealed class ${name} : EditorWindow`,
            '{',
            '    [MenuItem("Tools/OAC/' + name + '")]',
            '    private static void Open()',
            '    {',
            `        GetWindow<${name}>("${name}");`,
            '    }',
            '',
            '    private void OnGUI()',
            '    {',
            '        EditorGUILayout.LabelField("OAC tool window");',
            '    }',
            '}',
            '',
          ].join('\n')
        ),
    },
    test: {
      language: 'csharp',
      defaultName: 'NewTests',
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) =>
        namespaceWrap(
          namespace,
          [
            'using NUnit.Framework;',
            '',
            '[TestFixture]',
            `public sealed class ${name}`,
            '{',
            '    [Test]',
            '    public void Describes_the_expected_behaviour()',
            '    {',
            '        Assert.Pass();',
            '    }',
            '}',
            '',
          ].join('\n')
        ),
    },
    asmdef: {
      language: 'json',
      defaultName: 'NewAssembly',
      fileName: (name) => `${name}.asmdef`,
      render: (name) => JSON.stringify({ name, references: [], includePlatforms: [], allowUnsafeCode: false }, null, 2) + '\n',
    },
    interface: {
      language: 'csharp',
      defaultName: 'INewService',
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) =>
        namespaceWrap(namespace, [`public interface ${name}`, '{', '    void Execute();', '}', ''].join('\n')),
    },
    enum: {
      language: 'csharp',
      defaultName: 'NewState',
      fileName: (name) => `${name}.cs`,
      render: (name, namespace) =>
        namespaceWrap(
          namespace,
          [`public enum ${name}`, '{', '    None = 0,', '    Active = 1,', '}', ''].join('\n')
        ),
    },
  };
}

function shaderRegistry(): Registry {
  return {
    unlit: {
      language: 'shaderlab',
      defaultName: 'OacUnlit',
      fileName: (name) => `${name}.shader`,
      render: (name) =>
        [
          `Shader "OAC/${name}"`,
          '{',
          '    Properties',
          '    {',
          '        _BaseColor ("Base Color", Color) = (1, 1, 1, 1)',
          '        _MainTex ("Texture", 2D) = "white" {}',
          '    }',
          '    SubShader',
          '    {',
          '        Tags { "RenderType" = "Opaque" "Queue" = "Geometry" }',
          '        LOD 100',
          '        Pass',
          '        {',
          '            CGPROGRAM',
          '            #pragma vertex vert',
          '            #pragma fragment frag',
          '            #include "UnityCG.cginc"',
          '',
          '            struct appdata { float4 vertex : POSITION; float2 uv : TEXCOORD0; };',
          '            struct v2f { float4 vertex : SV_POSITION; float2 uv : TEXCOORD0; };',
          '',
          '            sampler2D _MainTex; float4 _MainTex_ST; fixed4 _BaseColor;',
          '',
          '            v2f vert(appdata v)',
          '            {',
          '                v2f o;',
          '                o.vertex = UnityObjectToClipPos(v.vertex);',
          '                o.uv = TRANSFORM_TEX(v.uv, _MainTex);',
          '                return o;',
          '            }',
          '',
          '            fixed4 frag(v2f i) : SV_Target',
          '            {',
          '                return tex2D(_MainTex, i.uv) * _BaseColor;',
          '            }',
          '            ENDCG',
          '        }',
          '    }',
          '}',
          '',
        ].join('\n'),
    },
    'urp-unlit': {
      language: 'shaderlab',
      defaultName: 'OacUrpUnlit',
      fileName: (name) => `${name}.shader`,
      render: (name) =>
        [
          `Shader "OAC/URP/${name}"`,
          '{',
          '    Properties',
          '    {',
          '        _BaseMap ("Base Map", 2D) = "white" {}',
          '        _BaseColor ("Base Color", Color) = (1, 1, 1, 1)',
          '    }',
          '    SubShader',
          '    {',
          '        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" }',
          '        Pass',
          '        {',
          '            Name "Forward"',
          '            HLSLPROGRAM',
          '            #pragma vertex Vert',
          '            #pragma fragment Frag',
          '            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"',
          '',
          '            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);',
          '            CBUFFER_START(UnityPerMaterial)',
          '            float4 _BaseMap_ST;',
          '            half4 _BaseColor;',
          '            CBUFFER_END',
          '',
          '            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };',
          '            struct Varyings { float4 positionHCS : SV_POSITION; float2 uv : TEXCOORD0; };',
          '',
          '            Varyings Vert(Attributes input)',
          '            {',
          '                Varyings output;',
          '                output.positionHCS = TransformObjectToHClip(input.positionOS.xyz);',
          '                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);',
          '                return output;',
          '            }',
          '',
          '            half4 Frag(Varyings input) : SV_Target',
          '            {',
          '                return SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv) * _BaseColor;',
          '            }',
          '            ENDHLSL',
          '        }',
          '    }',
          '}',
          '',
        ].join('\n'),
    },
    'urp-lit': {
      language: 'shaderlab',
      defaultName: 'OacUrpLit',
      fileName: (name) => `${name}.shader`,
      render: (name) =>
        [
          `Shader "OAC/URP/${name}"`,
          '{',
          '    Properties',
          '    {',
          '        _BaseMap ("Base Map", 2D) = "white" {}',
          '        _BaseColor ("Base Color", Color) = (1, 1, 1, 1)',
          '        _Smoothness ("Smoothness", Range(0, 1)) = 0.5',
          '    }',
          '    SubShader',
          '    {',
          '        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" }',
          '        Pass',
          '        {',
          '            Name "ForwardLit"',
          '            Tags { "LightMode" = "UniversalForward" }',
          '            HLSLPROGRAM',
          '            #pragma vertex Vert',
          '            #pragma fragment Frag',
          '            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"',
          '',
          '            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);',
          '            CBUFFER_START(UnityPerMaterial)',
          '            float4 _BaseMap_ST;',
          '            half4 _BaseColor;',
          '            half _Smoothness;',
          '            CBUFFER_END',
          '',
          '            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; };',
          '            struct Varyings { float4 positionHCS : SV_POSITION; float2 uv : TEXCOORD0; float3 normalWS : TEXCOORD1; };',
          '',
          '            Varyings Vert(Attributes input)',
          '            {',
          '                Varyings output;',
          '                VertexPositionInputs positions = GetVertexPositionInputs(input.positionOS.xyz);',
          '                output.positionHCS = positions.positionCS;',
          '                output.normalWS = TransformObjectToWorldNormal(input.normalOS);',
          '                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);',
          '                return output;',
          '            }',
          '',
          '            half4 Frag(Varyings input) : SV_Target',
          '            {',
          '                half3 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv).rgb * _BaseColor.rgb;',
          '                Light mainLight = GetMainLight();',
          '                half ndotl = saturate(dot(normalize(input.normalWS), mainLight.direction));',
          '                half3 lit = albedo * (mainLight.color * ndotl + 0.1h);',
          '                return half4(lit, 1.0h);',
          '            }',
          '            ENDHLSL',
          '        }',
          '    }',
          '}',
          '',
        ].join('\n'),
    },
    fullscreen: {
      language: 'shaderlab',
      defaultName: 'OacFullscreen',
      fileName: (name) => `${name}.shader`,
      render: (name) =>
        [
          `Shader "OAC/Fullscreen/${name}"`,
          '{',
          '    SubShader',
          '    {',
          '        Tags { "RenderPipeline" = "UniversalPipeline" }',
          '        Cull Off ZWrite Off ZTest Always',
          '        Pass',
          '        {',
          '            Name "FullscreenBlit"',
          '            HLSLPROGRAM',
          '            #pragma vertex Vert',
          '            #pragma fragment Frag',
          '            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"',
          '            #include "Packages/com.unity.render-pipelines.core/Runtime/Utilities/Blit.hlsl"',
          '',
          '            half4 Frag(Varyings input) : SV_Target',
          '            {',
          '                float2 uv = input.texcoord;',
          '                return SAMPLE_TEXTURE2D_X(_BlitTexture, sampler_LinearClamp, uv);',
          '            }',
          '            ENDHLSL',
          '        }',
          '    }',
          '}',
          '',
        ].join('\n'),
    },
  };
}

function inputRegistry(): Registry {
  return {
    'input-actions': {
      language: 'json',
      defaultName: 'GameControls',
      fileName: (name) => `${name}.inputactions`,
      render: (name, _namespace, options) => renderInputActions(name, options.map ?? 'Player'),
    },
    'player-input-actions': {
      language: 'json',
      defaultName: 'PlayerControls',
      fileName: (name) => `${name}.inputactions`,
      render: (name, _namespace, options) => renderInputActions(name, options.map ?? 'Player'),
    },
    'input-reader': {
      language: 'csharp',
      defaultName: 'InputReader',
      fileName: (name) => `${name}.cs`,
      render: (name, namespace, options) =>
        namespaceWrap(
          namespace,
          [
            'using UnityEngine;',
            'using UnityEngine.InputSystem;',
            '',
            `public sealed class ${name} : MonoBehaviour`,
            '{',
            '    [SerializeField] private InputActionAsset actions;',
            '    [SerializeField] private string actionMap = "' + (options.map ?? 'Player') + '";',
            '',
            '    private InputAction moveAction;',
            '',
            '    private void OnEnable()',
            '    {',
            '        if (actions == null) return;',
            '        actions.FindActionMap(actionMap, true).Enable();',
            '        moveAction = actions.FindAction(actionMap + "/Move");',
            '    }',
            '',
            '    private void OnDisable()',
            '    {',
            '        if (actions != null) actions.FindActionMap(actionMap, false)?.Disable();',
            '    }',
            '',
            '    private void Update()',
            '    {',
            '        if (moveAction == null) return;',
            '        Vector2 move = moveAction.ReadValue<Vector2>();',
            '        transform.position += new Vector3(move.x, 0f, move.y) * Time.deltaTime;',
            '    }',
            '}',
            '',
          ].join('\n')
        ),
    },
    'input-map-json': {
      language: 'json',
      defaultName: 'InputMap',
      fileName: (name) => `${name}.json`,
      render: (name, _namespace, options) =>
        JSON.stringify(
          {
            name,
            map: options.map ?? 'Player',
            actions: [
              { name: 'Move', type: 'Value', controlType: 'Vector2' },
              { name: 'Look', type: 'Value', controlType: 'Vector2' },
              { name: 'Jump', type: 'Button', controlType: 'Button' },
              { name: 'Fire', type: 'Button', controlType: 'Button' },
            ],
          },
          null,
          2
        ) + '\n',
    },
  };
}

function renderInputActions(name: string, map: string): string {
  const document = {
    name,
    maps: [
      {
        name: map,
        id: `${name}-${map}`,
        actions: [
          { name: 'Move', type: 'Value', controlType: 'Vector2' },
          { name: 'Look', type: 'Value', controlType: 'Vector2' },
          { name: 'Jump', type: 'Button', controlType: 'Button' },
          { name: 'Fire', type: 'Button', controlType: 'Button' },
        ],
        bindings: [
          { action: 'Move', path: '<Gamepad>/leftStick', groups: 'Gamepad' },
          { action: 'Move', path: '2DVector', groups: 'Keyboard&Mouse', isComposite: true },
          { action: 'Move', path: '<Keyboard>/w', groups: 'Keyboard&Mouse', isPartOfComposite: true },
          { action: 'Move', path: '<Keyboard>/s', groups: 'Keyboard&Mouse', isPartOfComposite: true },
          { action: 'Move', path: '<Keyboard>/a', groups: 'Keyboard&Mouse', isPartOfComposite: true },
          { action: 'Move', path: '<Keyboard>/d', groups: 'Keyboard&Mouse', isPartOfComposite: true },
          { action: 'Look', path: '<Mouse>/delta', groups: 'Keyboard&Mouse' },
          { action: 'Look', path: '<Gamepad>/rightStick', groups: 'Gamepad' },
          { action: 'Jump', path: '<Keyboard>/space', groups: 'Keyboard&Mouse' },
          { action: 'Jump', path: '<Gamepad>/buttonSouth', groups: 'Gamepad' },
          { action: 'Fire', path: '<Mouse>/leftButton', groups: 'Keyboard&Mouse' },
          { action: 'Fire', path: '<Gamepad>/rightTrigger', groups: 'Gamepad' },
        ],
      },
    ],
    controlSchemes: [
      { name: 'Keyboard&Mouse', bindingGroup: 'Keyboard&Mouse' },
      { name: 'Gamepad', bindingGroup: 'Gamepad' },
    ],
  };
  return JSON.stringify(document, null, 2) + '\n';
}

// Resolve `--out` to a concrete file path. An existing path is classified by
// `statSync` (directory -> append the file name, file -> write verbatim). A
// non-existent path is treated as a directory unless it already looks like a
// file: a non-empty extension (e.g. `Player.cs`) names the target explicitly,
// while a bare path (`Assets/Scripts`) is the folder to create the file in.
function resolveOutTarget(outPath: string, fileName: string): string {
  if (existsSync(outPath)) {
    return statSync(outPath).isDirectory() ? join(outPath, fileName) : outPath;
  }
  const ext = extname(outPath);
  // `extname` returns '.' for a path like 'foo.' — treat that as no extension.
  return ext !== '' && ext !== '.' ? outPath : join(outPath, fileName);
}

function emit(options: ActOptions, registry: Registry, defaultTemplate: string, label: string): TemplateResult {
  const template = options.template?.trim() || defaultTemplate;
  const available = Object.keys(registry);
  const entry = registry[template];

  const base = makeResult(options.ability, 'unknown', `${label} template`, [], 'offline');
  const result: TemplateResult = {
    ...base,
    template,
    language: null,
    fileName: null,
    content: null,
    written: false,
    outPath: null,
    available,
  };

  if (!entry) {
    result.errors = [`unknown template "${template}"; available: ${available.join(', ')}`];
    result.summary = `Unknown ${label.toLowerCase()} template "${template}"`;
    return result;
  }

  const name = options.name?.trim() || entry.defaultName;
  const namespace = options.namespace?.trim() || '';
  const content = entry.render(name, namespace, options);
  const fileName = entry.fileName(name);

  result.language = entry.language;
  result.fileName = fileName;
  result.content = content;

  if (!options.out) {
    result.status = 'proposed';
    result.summary = `Proposed ${fileName} (${content.length} chars); nothing written`;
    return result;
  }

  const outPath = options.out;
  if (options.dryRun) {
    result.status = 'proposed';
    result.outPath = outPath;
    result.summary = `Dry run: would write ${fileName} to ${outPath}; nothing written`;
    return result;
  }

  if (!options.confirm) {
    result.status = 'refused';
    result.errors = ['refusing to write without --confirm'];
    result.summary = 'Refused: writing a file requires --confirm';
    return result;
  }

  const target = resolveOutTarget(outPath, fileName);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  result.status = 'written';
  result.written = true;
  result.mutated = true;
  result.outPath = target;
  result.summary = `Wrote ${fileName} to ${target}`;
  return result;
}

export function scriptScaffolding(options: ActOptions): TemplateResult {
  return emit(options, scriptRegistry(), 'monobehaviour', 'Script');
}

export function shaderHelper(options: ActOptions): TemplateResult {
  return emit(options, shaderRegistry(), 'urp-unlit', 'Shader');
}

export function inputAutomation(options: ActOptions): TemplateResult {
  return emit(options, inputRegistry(), 'input-actions', 'Input');
}

export type { ActStatus };

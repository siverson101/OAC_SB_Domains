using System.Collections.Generic;
using System.IO;
using UnityEngine;
using System;
using System.Text;
using System.IO.Compression;

namespace UnityEncyclopedia.Primitives.Parsers {

    public enum BlendMode {
        Normal         = 0,
        Multiply       = 1,
        Screen         = 2,
        Overlay        = 3,
        Darken         = 4,
        Lighten        = 5,
        ColorDodge     = 6,
        ColorBurn      = 7,
        HardLight      = 8,
        SoftLight      = 9,
        Difference     = 10,
        Exclusion      = 11,
        Hue            = 12,
        Saturation     = 13,
        Color          = 14,
        Luminosity     = 15,
        Addition       = 16,
        Subtract       = 17,
        Divide         = 18,
    }

    public class ASEFile {
        public int width, height;
        public List<Frame> frames = new List<Frame>();
        public List<Layer> layers = new List<Layer>();
        public List<FrameTag> frameTags = new List<FrameTag>();

        public Layer FindLayer(int index) {
            for (int i = 0; i < layers.Count; ++i) {
                var layer = layers[i];
                if (layer.index == index)
                    return layer;
            }
            return null;
        }
    }

    public class Frame {
        public int duration;
        public int frameID;
        public Dictionary<int, Cel> cels = new Dictionary<int, Cel>();
    }

    public class Layer : UserDataAcceptor {
        public int index;
        public int parentIndex; // =1 if level==0 (have no parent), otherwise the index of direct parent
        public bool visible;
        public BlendMode blendMode;
        public float opacity;
        public string layerName;
        public string userData { get; set; }
    }

    internal enum CelType {
        Raw, Linked, Compressed
    }

    public class Cel : UserDataAcceptor {
        static readonly Color Opaque = new Color(0, 0, 0, 0);

        public int layerIndex;
        public float opacity;
        public int x, y, width, height;

        public string userData { get; set; }

        internal CelType type;
        internal int linkedCel; // -1 if is raw cel, otherwise linked cel

        public Color[] colorBuffer;

        // Get the color of the cel in cel space
        public Color GetPixelRaw(int px, int py) {
            return colorBuffer[py * width + px];
        }

        // Get the color of the cel in sprite image space
        public Color GetPixel(int px, int py) {
            var relx = px - this.x;
            var rely = py - this.y;
            if (0 <= relx && relx < width &&
                0 <= rely && rely < height) {
                return GetPixelRaw(relx, rely);
            } else {
                return Opaque;
            }
        }
    }

    public interface UserDataAcceptor {
        string userData { get; set; }
    }

    public class FrameTag {
        public int from, to;
        public string name;
        public readonly HashSet<string> properties = new HashSet<string>();
    }

    public static class AsepriteParser {

        const UInt16
            CHUNK_LAYER = 0x2004,
            CHUNK_CEL = 0x2005,
            CHUNK_CELEXTRA = 0x2006,
            CHUNK_FRAME_TAGS = 0x2018,
            CHUNK_PALETTE = 0x2019,
            CHUNK_USERDATA = 0x2020;

        public static ASEFile Parse(byte[] bytes) {
            var stream = new MemoryStream(bytes);
            using (var reader = new BinaryReader(stream)) {
                var file = new ASEFile();

                reader.ReadUInt32(); // File size
                _CheckMagicNumber(reader.ReadUInt16(), (ushort)0xA5E0);

                var frameCount = reader.ReadUInt16();

                file.width = reader.ReadUInt16();
                file.height = reader.ReadUInt16();

                var colorDepth = reader.ReadUInt16(); 

                if (colorDepth != 32) {
                    throw new Exception("Non RGBA color mode isn't supported yet");
                }

                reader.ReadUInt32(); // Flags
                reader.ReadUInt16(); // Deprecated speed
                _CheckMagicNumber(reader.ReadUInt32(), 0u);
                _CheckMagicNumber(reader.ReadUInt32(), 0u);

                reader.ReadBytes(4);
                reader.ReadUInt16();
                reader.ReadBytes(2);
                reader.ReadBytes(92);
                int readLayerIndex = 0;

                UserDataAcceptor lastUserdataAcceptor = null;

                var levelToIndex = new Dictionary<int, int>();
                var enabledLayerIdxs = new List<int>();

                for (int i = 0; i < frameCount; ++i) {
                    var frame = new Frame();
                    frame.frameID = i;

                    reader.ReadUInt32(); // frameBytes
                    _CheckMagicNumber(reader.ReadUInt16(), (ushort)0xF1FA);

                    var chunkCount = reader.ReadUInt16();
                    
                    frame.duration = reader.ReadUInt16();

                    reader.ReadBytes(6);

                    for (int j = 0; j < chunkCount; ++j) {
                        var chunkBytes = reader.ReadUInt32(); // 4
                        var chunkType = reader.ReadUInt16(); // 2

                        switch (chunkType) {
                        case CHUNK_LAYER: {
                            var layer = new Layer();
                            var flags = reader.ReadUInt16();

                            layer.visible = (flags & 0x1) != 0;
                            
                            var layerType = reader.ReadUInt16();
                            var childLevel = reader.ReadUInt16(); // childLevel
                            if (childLevel == 0) {
                                layer.parentIndex = -1;
                            } else {
                                layer.parentIndex = levelToIndex[childLevel - 1];
                            }

                            reader.ReadUInt16();
                            reader.ReadUInt16();

                            layer.blendMode = (BlendMode) reader.ReadUInt16();
                            layer.opacity = reader.ReadByte() / 255.0f;
                            reader.ReadBytes(3);

                            layer.layerName = reader.ReadUTF8();

                            var parentEnable = layer.parentIndex == -1 || enabledLayerIdxs.Contains(layer.parentIndex);
                            var thisEnable = layer.visible && !layer.layerName.StartsWith("//");
                            
                            if (parentEnable && thisEnable) {
                                if (layerType == 0) {
                                    layer.index = readLayerIndex;
                                    file.layers.Add(layer);
                                }

                                enabledLayerIdxs.Add(readLayerIndex);
                            }

                            if (levelToIndex.ContainsKey(childLevel))
                                levelToIndex[childLevel] = readLayerIndex;
                            else
                                levelToIndex.Add(childLevel, readLayerIndex);

                            ++readLayerIndex;
                            
                            lastUserdataAcceptor = layer;

                        } break;

                        case CHUNK_CEL: {
                            var cel = new Cel();

                            cel.layerIndex = reader.ReadUInt16(); // 2
                            cel.x = reader.ReadInt16(); // 2
                            cel.y = reader.ReadInt16(); // 2
                            cel.opacity = reader.ReadByte() / 255.0f; // 1
                            cel.type = (CelType) reader.ReadUInt16(); // 2
                            reader.ReadBytes(7); // 7

                            switch (cel.type) {
                                case CelType.Raw: {
                                    cel.width = reader.ReadUInt16(); // 2
                                    cel.height = reader.ReadUInt16(); // 2
                                    cel.colorBuffer = ToColorBufferRGBA(reader.ReadBytes((int)chunkBytes - 6 - 16 - 4)); 
                                } break;
                                case CelType.Linked: {
                                    cel.linkedCel = reader.ReadUInt16();
                                } break;
                                case CelType.Compressed: {
                                    cel.width = reader.ReadUInt16();
                                    cel.height = reader.ReadUInt16();
                                    cel.colorBuffer = ToColorBufferRGBA(
                                        reader.ReadCompressedBytes((int)chunkBytes - 6 - 16 - 4));
                                } break;
                            }

                            if (file.FindLayer(cel.layerIndex) != null)
                                frame.cels.Add(cel.layerIndex, cel);

                            lastUserdataAcceptor = cel;

                        } break;

                        case CHUNK_FRAME_TAGS: {
                            var count = reader.ReadUInt16();
                            reader.ReadBytes(8);

                            for (int c = 0; c < count; ++c) {
                                var frameTag = new FrameTag();

                                frameTag.from = reader.ReadUInt16();
                                frameTag.to = reader.ReadUInt16();
                                reader.ReadByte();
                                reader.ReadBytes(8);
                                reader.ReadBytes(3);
                                reader.ReadByte();

                                frameTag.name = reader.ReadUTF8();

                                if (frameTag.name.StartsWith("//")) { // Commented tags are ignored
                                    continue;
                                }

                                var originalName = frameTag.name;
                                var tagIdx = frameTag.name.IndexOf('#');
                                if (tagIdx != -1) {
                                    frameTag.name = frameTag.name.Substring(0, tagIdx).Trim();
                                    var possibleProperties = originalName.Substring(tagIdx).Split(' ');
                                    foreach (var possibleProperty in possibleProperties) {
                                        if (possibleProperty.Length > 1 && possibleProperty[0] == '#') {
                                            frameTag.properties.Add(possibleProperty.Substring(1));
                                        }
                                    }
                                }

                                file.frameTags.Add(frameTag);
                            }

                        } break;

                        case CHUNK_USERDATA: {
                            var flags = reader.ReadUInt32();
                            var hasText = (flags & 0x01) != 0;
                            var hasColor = (flags & 0x02) != 0;

                            if (hasText && lastUserdataAcceptor != null) {
                                lastUserdataAcceptor.userData = reader.ReadUTF8();
                            }

                            if (hasColor) {
                                reader.ReadBytes(4);
                            }

                        } break;

                        default: {
                            reader.ReadBytes((int)chunkBytes - 6);
                        } break;

                        }
                    }

                    file.frames.Add(frame);
                }

                // Post process: calculate pixel alpha
                for (int f = 0; f < file.frames.Count; ++f) {
                    var frame = file.frames[f];
                    foreach (var cel in frame.cels.Values) {
                        if (cel.type != CelType.Linked) {
                            for(int i = 0; i < cel.colorBuffer.Length; ++i) {
                                cel.colorBuffer[i].a *= cel.opacity * file.FindLayer(cel.layerIndex).opacity;
                            }
                        }
                    }
                }

                // Post process: eliminate reference cels
                for (int f = 0; f < file.frames.Count; ++f) {
                    var frame = file.frames[f];
                    foreach (var pair in frame.cels) {
                        var layerID = pair.Key;
                        var cel = pair.Value;
                        if (cel.type == CelType.Linked) {
                            cel.type = CelType.Raw;
                            var src = file.frames[cel.linkedCel].cels[layerID];
                            cel.x = src.x;
                            cel.y = src.y;
                            cel.width = src.width;
                            cel.height = src.height;
                            cel.colorBuffer = src.colorBuffer;
                            cel.opacity = src.opacity;
                            cel.userData = src.userData;
                        }
                    }
                }

                return file;
            }
        }

        static string ReadUTF8(this BinaryReader reader) {
            var length = reader.ReadUInt16();
            var chars = reader.ReadBytes(length);
            return Encoding.UTF8.GetString(chars);
        }

        static Color[] ToColorBufferRGBA(byte[] bytes) {
            var arr = new Color[bytes.Length / 4];
            for (int i = 0; i < arr.Length; ++i) {
                var offset = i << 2;
                Color color = Color.white;
                color.r = bytes[offset] / 255.0f;
                color.g = bytes[offset + 1] / 255.0f;
                color.b = bytes[offset + 2] / 255.0f;
                color.a = bytes[offset + 3] / 255.0f;
                arr[i] = color;
            }
            return arr;
        }

        static byte[] ReadCompressedBytes(this BinaryReader reader, int count) {
            reader.ReadByte();
            reader.ReadByte();
            using (var deflateStream = new DeflateStream(
                    new MemoryStream(reader.ReadBytes(count - 2 - 4)), CompressionMode.Decompress)) {
                var bytes = ReadFully(deflateStream);
                reader.ReadUInt32(); // Skip the ADLER32 checksum
                return bytes;
            }
        }

        static byte[] ReadFully(Stream input) {
            byte[] buffer = new byte[16*1024];
            using (MemoryStream ms = new MemoryStream()) {
                int read;
                while ((read = input.Read(buffer, 0, buffer.Length)) > 0) {
                    ms.Write(buffer, 0, read);
                }
                return ms.ToArray();
            }
        }

        static void _CheckMagicNumber<T>(T number, T expected)
            where T: IEquatable<T> {
            if (!(number.Equals(expected))) {
                throw new Exception("File validation failed. Invalid Aseprite magic number.");
            }
        }
    }
}

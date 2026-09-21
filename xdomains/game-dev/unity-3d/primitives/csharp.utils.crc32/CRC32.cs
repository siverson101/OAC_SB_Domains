// Derived from https://github.com/YarnSpinnerTool/YarnSpinner (MIT).
using System;
using System.Text;
using System.Buffers;

namespace Yarn.Utility
{
    /// <summary>
    /// Provides a method for generating CRC32 hashes without heap allocations.
    /// </summary>
    public static class CRC32
    {
        private static readonly uint[] LookupTable = new uint[256];

        static CRC32()
        {
            uint seedPolynomial = 0xedb88320;
            uint temp;
            for (uint i = 0; i < LookupTable.Length; ++i)
            {
                temp = i;
                for (int j = 8; j > 0; --j)
                {
                    if ((temp & 1) == 1)
                    {
                        temp = (temp >> 1) ^ seedPolynomial;
                    }
                    else
                    {
                        temp >>= 1;
                    }
                }

                LookupTable[i] = temp;
            }
        }

        /// <summary>
        /// Computes a CRC32 checksum from the given span of bytes.
        /// </summary>
        public static uint GetChecksum(ReadOnlySpan<byte> bytes)
        {
            uint crc = 0xffffffff;
            for (int i = 0; i < bytes.Length; ++i)
            {
                byte index = (byte)((crc & 0xff) ^ bytes[i]);
                crc = (crc >> 8) ^ LookupTable[index];
            }

            return ~crc;
        }

        /// <summary>
        /// Computes a CRC32 checksum from the given string without heap allocations.
        /// </summary>
        public static uint GetChecksum(ReadOnlySpan<char> s)
        {
            int byteCount = Encoding.UTF8.GetByteCount(s);
            byte[] rentedArray = null;
            
            try
            {
                Span<byte> buffer = byteCount <= 1024 
                    ? stackalloc byte[byteCount] 
                    : (rentedArray = ArrayPool<byte>.Shared.Rent(byteCount));
                
                int written = Encoding.UTF8.GetBytes(s, buffer);
                return GetChecksum(buffer.Slice(0, written));
            }
            finally
            {
                if (rentedArray != null)
                {
                    ArrayPool<byte>.Shared.Return(rentedArray);
                }
            }
        }

        /// <summary>
        /// Gets the CRC-32 hash of a string as a lowercase hexadecimal string without intermediate allocations.
        /// </summary>
        public static string GetChecksumString(ReadOnlySpan<char> s)
        {
            uint checksum = GetChecksum(s);
            return checksum.ToString("x8");
        }
    }
}

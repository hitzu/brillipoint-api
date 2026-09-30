import {
  resolvePublicThemeCache,
  EVENT_THEME_CACHE_CONTROL,
} from './public-theme-cache';

describe('resolvePublicThemeCache', () => {
  it('forces a non-cacheable full response for cache=off despite a matching ETag', () => {
    // Arrange
    const isMatchingEtag = jest.fn().mockReturnValue(true);

    // Act
    const result = resolvePublicThemeCache('off', isMatchingEtag);

    // Assert
    expect(result).toEqual({ cacheControl: 'no-store', notModified: false });
    expect(isMatchingEtag).not.toHaveBeenCalled();
  });

  it('preserves the existing cache policy and conditional response by default', () => {
    // Arrange
    const isMatchingEtag = jest.fn().mockReturnValue(true);

    // Act
    const result = resolvePublicThemeCache(undefined, isMatchingEtag);

    // Assert
    expect(result).toEqual({
      cacheControl: EVENT_THEME_CACHE_CONTROL,
      notModified: true,
    });
    expect(isMatchingEtag).toHaveBeenCalledTimes(1);
  });

  it('ignores cache values other than the exact off flag', () => {
    // Arrange
    const isMatchingEtag = jest.fn().mockReturnValue(false);

    // Act
    const result = resolvePublicThemeCache('false', isMatchingEtag);

    // Assert
    expect(result).toEqual({
      cacheControl: EVENT_THEME_CACHE_CONTROL,
      notModified: false,
    });
    expect(isMatchingEtag).toHaveBeenCalledTimes(1);
  });
});

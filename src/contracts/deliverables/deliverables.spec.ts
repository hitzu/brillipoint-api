import { toDeliverableItems, withoutProducts } from './deliverables';

describe('deliverables', () => {
  describe('toDeliverableItems', () => {
    it('should merge repeated products by summing their quantity', () => {
      // Arrange
      const rows = [
        { productId: 1, quantity: 1, product: { name: 'Tira de fotos' } },
        { productId: 1, quantity: 2, product: { name: 'Tira de fotos' } },
        { productId: 2, quantity: 1, product: { name: 'Lienzo' } },
      ];

      // Act
      const result = toDeliverableItems(rows);

      // Assert
      expect(result).toEqual([
        { productId: 1, name: 'Tira de fotos', quantity: 3 },
        { productId: 2, name: 'Lienzo', quantity: 1 },
      ]);
    });
  });

  describe('withoutProducts', () => {
    it('should drop removed products and ignore ids the list does not have', () => {
      // Arrange
      const items = [
        { productId: 1, name: 'Back LED', quantity: 1 },
        { productId: 2, name: 'Polaroid', quantity: 1 },
      ];

      // Act
      const result = withoutProducts(items, [2, 2, 99]);

      // Assert
      expect(result).toEqual([{ productId: 1, name: 'Back LED', quantity: 1 }]);
    });
  });
});
